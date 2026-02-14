// Higher-level rate limiting helpers for API routes
// Combines authentication context with D1-based rate limiting

import { NextResponse } from 'next/server';
import { getDb } from '../db/client';
import type { UnifiedAuthResult } from '../auth/jwt';
import {
  checkRateLimit,
  createRateLimitResponse,
  withRateLimitHeaders,
  ipRateLimitKey,
  apiKeyRateLimitKey,
  sessionRateLimitKey,
  RATE_LIMITS,
  type RateLimitResult,
} from './rateLimit';

/**
 * Apply rate limiting for authenticated API endpoints.
 * Uses API key ID for apiKey auth, or userId for session auth.
 * Returns null if allowed, or a 429 Response if rate limited.
 */
export async function rateLimitApi(
  request: Request,
  auth: UnifiedAuthResult
): Promise<{ response: Response } | { result: RateLimitResult }> {
  const db = getDb();
  const config = RATE_LIMITS.API_STANDARD;

  const key = auth.authType === 'apiKey' && auth.keyId
    ? apiKeyRateLimitKey(auth.keyId)
    : sessionRateLimitKey(auth.userId || auth.workspaceId, 'api');

  const result = await checkRateLimit(db, key, config);

  if (!result.allowed) {
    return { response: createRateLimitResponse(result) };
  }

  return { result };
}

/**
 * Apply rate limiting for auth endpoints (login/signup) using IP.
 * Returns null if allowed, or a 429 Response if rate limited.
 */
export async function rateLimitAuth(
  request: Request,
  endpoint: 'login' | 'signup'
): Promise<{ response: Response } | { result: RateLimitResult }> {
  const db = getDb();
  const config = endpoint === 'login' ? RATE_LIMITS.AUTH_LOGIN : RATE_LIMITS.AUTH_SIGNUP;
  const key = ipRateLimitKey(request, endpoint);

  const result = await checkRateLimit(db, key, config);

  if (!result.allowed) {
    return { response: createRateLimitResponse(result) };
  }

  return { result };
}

/**
 * Apply rate limit headers to a NextResponse based on a rate limit result.
 */
export function applyRateLimitHeaders(response: NextResponse, result: RateLimitResult): NextResponse {
  return withRateLimitHeaders(response, result);
}
