// Session management using JWT tokens in HTTP-only cookies
import { SignJWT, jwtVerify } from 'jose';
import type { SessionPayload } from '@taskinfa/shared';
import { NextResponse } from 'next/server';

// Lazy-load SESSION_SECRET with validation (only when actually used)
let _secret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (_secret) return _secret;

  const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (!SESSION_SECRET) {
    throw new Error('SESSION_SECRET or JWT_SECRET environment variable is required');
  }
  _secret = new TextEncoder().encode(SESSION_SECRET);
  return _secret;
}

const secret = getSecret;

// Session cookie configuration
const COOKIE_NAME = 'session_token';
const SESSION_MAX_AGE = parseInt(process.env.SESSION_MAX_AGE || '604800', 10); // 7 days default

/**
 * Create a session JWT token for a user
 * @param userId - User ID
 * @param workspaceId - User's workspace ID
 * @returns Promise resolving to JWT token string
 */
export async function createSession(userId: string, workspaceId: string): Promise<string> {
  const payload: SessionPayload = {
    userId,
    workspaceId,
    type: 'user',
  };

  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());

  return token;
}

/**
 * Verify and decode a session token
 * @param token - JWT token to verify
 * @returns Promise resolving to session payload or null if invalid
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());

    // Validate payload structure
    if (
      typeof payload.userId !== 'string' ||
      typeof payload.workspaceId !== 'string' ||
      payload.type !== 'user'
    ) {
      return null;
    }

    return payload as unknown as SessionPayload;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}

/**
 * Set session cookie in response
 * @param response - NextResponse object
 * @param token - JWT token to set as cookie
 * @returns Modified response with cookie
 */
export function setSessionCookie(response: NextResponse, token: string): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production';

  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });

  return response;
}

/**
 * Clear session cookie from response
 * @param response - NextResponse object
 * @returns Modified response with cookie cleared
 */
export function clearSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(COOKIE_NAME);
  return response;
}

/**
 * Get session token from request cookies
 * @param cookies - Request cookies
 * @returns Session token or null if not found
 */
export function getSessionToken(cookies: any): string | null {
  return cookies.get(COOKIE_NAME)?.value || null;
}
