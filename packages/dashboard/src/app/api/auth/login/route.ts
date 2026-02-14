import { NextRequest, NextResponse } from 'next/server';
import { getDb, execute, queryOne } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';
import { normalizeEmail } from '@/lib/validations/auth';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { rateLimitAuth, applyRateLimitHeaders } from '@/lib/middleware/apiRateLimit';
import type { LoginRequest, LoginResponse, User, Workspace } from '@taskinfa/shared';
import { createErrorResponse, authenticationError, authorizationError, internalError } from '@/lib/utils';


export async function POST(request: NextRequest) {
  // Per-IP rate limiting for login (10 attempts/min)
  const rl = await rateLimitAuth(request, 'login');
  if ('response' in rl) return rl.response;

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

    // Set session cookie and return response with rate limit headers
    const nextResponse = NextResponse.json(response, { status: 200 });
    applyRateLimitHeaders(nextResponse, rl.result);
    return setSessionCookie(nextResponse, sessionToken);

  } catch (error) {
    return createErrorResponse(error, { operation: 'login' });
  }
}
