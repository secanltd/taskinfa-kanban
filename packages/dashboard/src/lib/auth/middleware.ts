// Authentication middleware supporting both session and API key auth
import { NextRequest } from 'next/server';
import { verifySessionToken, getSessionToken } from './session';
import { authenticateRequest as authenticateApiKey } from './jwt';
import type { SessionPayload } from '@taskinfa/shared';

export interface AuthContext {
  userId?: string;
  workspaceId: string;
  authType: 'session' | 'apiKey';
}

/**
 * Require user session authentication
 * Extracts and verifies session token from cookies
 * @param request - Next.js request object
 * @returns Session payload or null if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionToken(request.cookies);

  if (!token) {
    return null;
  }

  return await verifySessionToken(token);
}

/**
 * Enhanced authentication supporting both session and API key
 * Tries session auth first (for dashboard UI), then API key auth (for bot/API)
 * @param request - Next.js or standard Request object
 * @returns Auth context with workspaceId and auth type, or null if not authenticated
 */
export async function authenticateRequestDual(
  request: Request | NextRequest
): Promise<AuthContext | null> {
  // Try session authentication first (for dashboard users)
  if ('cookies' in request) {
    const token = getSessionToken((request as NextRequest).cookies);
    if (token) {
      const session = await verifySessionToken(token);
      if (session) {
        return {
          userId: session.userId,
          workspaceId: session.workspaceId,
          authType: 'session',
        };
      }
    }
  }

  // Fall back to API key authentication (for bots/API clients)
  const apiKeyPayload = await authenticateApiKey(request);
  if (apiKeyPayload) {
    return {
      workspaceId: apiKeyPayload.workspaceId,
      authType: 'apiKey',
    };
  }

  return null;
}

/**
 * Extract workspace ID from authenticated request
 * Supports both session and API key authentication
 * @param request - Request object
 * @returns Workspace ID or null
 */
export async function getWorkspaceId(request: Request | NextRequest): Promise<string | null> {
  const auth = await authenticateRequestDual(request);
  return auth?.workspaceId || null;
}

/**
 * Create authentication error response
 * @param message - Error message
 * @param status - HTTP status code
 * @returns Response object
 */
export function authError(message: string, status: number = 401): Response {
  return new Response(
    JSON.stringify({
      error: message,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
