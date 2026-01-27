import { NextRequest, NextResponse } from 'next/server';
import { getDb, execute, queryOne } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { normalizeEmail } from '@/lib/validations/auth';
import { createSession, setSessionCookie } from '@/lib/auth/session';
// Rate limiting is now handled at Cloudflare level (see RATE_LIMITING_IMPLEMENTATION.md)
// import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '@/lib/middleware/rateLimit';
import type { LoginRequest, LoginResponse, User, Workspace } from '@taskinfa/shared';
import { createErrorResponse, authenticationError, authorizationError, internalError } from '@/lib/utils';


export async function POST(request: NextRequest) {
  // Rate limiting - TEMPORARILY DISABLED (in-memory rate limiting doesn't work in Workers)
  // TODO: Implement proper rate limiting using Cloudflare Rate Limiting API or Durable Objects
  // const rateLimit = checkRateLimit(request, 'login', RATE_LIMITS.LOGIN);
  // if (!rateLimit.allowed) {
  //   return createRateLimitResponse(rateLimit.resetAt);
  // }

  try {
    const body: LoginRequest = await request.json();
    const { email, password } = body;

    // Validate required fields
    if (!email || !password) {
      throw authenticationError('Email and password are required');
    }

    const normalizedEmail = normalizeEmail(email);
    const db = getDb();

    // Find user by email
    const user = await queryOne<User>(
      db,
      'SELECT * FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (!user) {
      throw authenticationError('Invalid email or password');
    }

    // Check if account is active
    if (!user.is_active) {
      throw authorizationError('Account has been disabled');
    }

    // Verify password
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      throw authenticationError('Invalid email or password');
    }

    // Update last_login_at
    await execute(
      db,
      'UPDATE users SET last_login_at = datetime("now") WHERE id = ?',
      [user.id]
    );

    // Fetch workspace
    const workspace = await queryOne<Workspace>(
      db,
      'SELECT * FROM workspaces WHERE id = ?',
      [user.workspace_id]
    );

    if (!workspace) {
      throw internalError('Workspace not found');
    }

    // Create session token
    const sessionToken = await createSession(user.id, user.workspace_id);

    // Prepare response without password_hash
    const { password_hash, ...userWithoutPassword } = user;
    const response: LoginResponse = {
      user: {
        ...userWithoutPassword,
        is_verified: Boolean(userWithoutPassword.is_verified),
        is_active: Boolean(userWithoutPassword.is_active),
      },
      workspace,
    };

    // Set session cookie and return response
    const nextResponse = NextResponse.json(response, { status: 200 });
    return setSessionCookie(nextResponse, sessionToken);

  } catch (error) {
    return createErrorResponse(error, { operation: 'login' });
  }
}
