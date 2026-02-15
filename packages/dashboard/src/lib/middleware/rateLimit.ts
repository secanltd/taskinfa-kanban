// D1-based sliding window rate limiter for Cloudflare Workers
// Replaces the old in-memory rate limiter which doesn't work in stateless Workers

import type { D1Database } from '../db/client';

/**
 * Rate limit tier configuration
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Result from a rate limit check
 */
export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix epoch ms
}

/**
 * Rate limit configurations for different endpoint tiers
 */
export const RATE_LIMITS = {
  // Auth endpoints - per IP
  AUTH_LOGIN: { maxRequests: 10, windowMs: 60 * 1000 },      // 10/min
  AUTH_SIGNUP: { maxRequests: 5, windowMs: 60 * 1000 },       // 5/min

  // API key management - per session
  API_KEY_CREATE: { maxRequests: 10, windowMs: 60 * 60 * 1000 }, // 10/hour

  // Standard API - per API key or session
  API_STANDARD: { maxRequests: 100, windowMs: 60 * 1000 },   // 100/min

  // Orchestrator tier - per API key (higher limit)
  API_ORCHESTRATOR: { maxRequests: 1000, windowMs: 60 * 1000 }, // 1000/min
} as const;

/**
 * Extract client IP from request headers
 */
export function getClientIp(request: Request): string {
  // Cloudflare provides the connecting IP
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

/**
 * Check rate limit using D1 sliding window.
 * Records the request and returns whether it's allowed.
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  const resetAt = now + config.windowMs;

  try {
    // Insert first, then count — reduces the race window vs count-then-insert.
    await db
      .prepare('INSERT INTO rate_limit_entries (key, timestamp, expires_at) VALUES (?, ?, ?)')
      .bind(key, now, now + config.windowMs)
      .run();

    const countResult = await db
      .prepare('SELECT COUNT(*) as count FROM rate_limit_entries WHERE key = ? AND timestamp > ?')
      .bind(key, windowStart)
      .first<{ count: number }>();

    const currentCount = countResult?.count ?? 1;

    if (currentCount > config.maxRequests) {
      // Over limit — delete the entry we just inserted
      await db
        .prepare('DELETE FROM rate_limit_entries WHERE key = ? AND timestamp = ?')
        .bind(key, now)
        .run();

      return {
        allowed: false,
        limit: config.maxRequests,
        remaining: 0,
        resetAt,
      };
    }

    // Opportunistic cleanup of old entries (~5% of the time)
    if (Math.random() < 0.05) {
      db.prepare('DELETE FROM rate_limit_entries WHERE expires_at < ?')
        .bind(now)
        .run()
        .catch(() => {}); // Ignore cleanup errors
    }

    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - currentCount,
      resetAt,
    };
  } catch (error) {
    // If rate limiting fails (e.g., table doesn't exist yet), allow the request
    console.error('Rate limit check failed:', error);
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetAt,
    };
  }
}

/**
 * Build a rate limit key for IP-based limiting (auth endpoints)
 */
export function ipRateLimitKey(request: Request, endpoint: string): string {
  return `ip:${getClientIp(request)}:${endpoint}`;
}

/**
 * Build a rate limit key for API key-based limiting
 */
export function apiKeyRateLimitKey(keyId: string): string {
  return `apikey:${keyId}`;
}

/**
 * Build a rate limit key for session-based limiting
 */
export function sessionRateLimitKey(userId: string, endpoint: string): string {
  return `session:${userId}:${endpoint}`;
}

/**
 * Apply rate limit headers to a Response/NextResponse
 */
export function withRateLimitHeaders<T extends Response>(
  response: T,
  result: RateLimitResult
): T {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(Math.max(0, result.remaining)));
  response.headers.set('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
  return response;
}

/**
 * Create a 429 Too Many Requests response with proper headers
 */
export function createRateLimitResponse(result: RateLimitResult): Response {
  const retryAfterSeconds = Math.ceil((result.resetAt - Date.now()) / 1000);

  return withRateLimitHeaders(
    new Response(
      JSON.stringify({
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.max(1, retryAfterSeconds)),
        },
      }
    ),
    result
  );
}
