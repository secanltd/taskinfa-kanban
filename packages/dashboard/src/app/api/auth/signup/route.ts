import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { getDb, execute, queryOne } from '@/lib/db/client';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { validateEmail, normalizeEmail } from '@/lib/validations/auth';
import { createSession, setSessionCookie } from '@/lib/auth/session';
// Rate limiting is now handled at Cloudflare level (see RATE_LIMITING_IMPLEMENTATION.md)
// import { checkRateLimit, createRateLimitResponse, RATE_LIMITS } from '@/lib/middleware/rateLimit';
import type { SignupRequest, SignupResponse, User, Workspace } from '@taskinfa/shared';
import { createErrorResponse, validationError, conflictError, internalError } from '@/lib/utils';


export async function POST(request: NextRequest) {
  // Rate limiting - TEMPORARILY DISABLED (in-memory rate limiting doesn't work in Workers)
  // TODO: Implement proper rate limiting using Cloudflare Rate Limiting API or Durable Objects
  // const rateLimit = checkRateLimit(request, 'signup', RATE_LIMITS.SIGNUP);
  // if (!rateLimit.allowed) {
  //   return createRateLimitResponse(rateLimit.resetAt);
  // }

  try {
    const body: SignupRequest = await request.json();
    const { email, password, name } = body;

    // Validate required fields
    if (!email || !password) {
      throw validationError('Email and password are required');
    }

    // Validate email format
    if (!validateEmail(email)) {
      throw validationError('Invalid email format');
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw validationError('Password validation failed', { errors: passwordValidation.errors });
    }

    const normalizedEmail = normalizeEmail(email);
    const db = getDb();

    // Check if email already exists
    const existingUser = await queryOne<User>(
      db,
      'SELECT id FROM users WHERE email = ?',
      [normalizedEmail]
    );

    if (existingUser) {
      throw conflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create workspace for user (1:1 relationship)
    const workspaceId = nanoid();
    const workspaceName = name ? `${name}'s Workspace` : 'My Workspace';

    await execute(
      db,
      'INSERT INTO workspaces (id, name, description) VALUES (?, ?, ?)',
      [workspaceId, workspaceName, 'Personal workspace']
    );

    // Create user
    const userId = nanoid();
    await execute(
      db,
      `INSERT INTO users (id, email, password_hash, name, workspace_id, is_verified, is_active)
       VALUES (?, ?, ?, ?, ?, 0, 1)`,
      [userId, normalizedEmail, passwordHash, name || null, workspaceId]
    );

    // Fetch created user and workspace
    const user = await queryOne<User>(db, 'SELECT * FROM users WHERE id = ?', [userId]);
    const workspace = await queryOne<Workspace>(db, 'SELECT * FROM workspaces WHERE id = ?', [workspaceId]);

    if (!user || !workspace) {
      throw internalError('Failed to create user');
    }

    // Create session token
    const sessionToken = await createSession(userId, workspaceId);

    // Prepare response without password_hash
    const { password_hash, ...userWithoutPassword } = user;
    const response: SignupResponse = {
      user: {
        ...userWithoutPassword,
        is_verified: Boolean(userWithoutPassword.is_verified),
        is_active: Boolean(userWithoutPassword.is_active),
      },
      workspace,
    };

    // Set session cookie and return response
    const nextResponse = NextResponse.json(response, { status: 201 });
    return setSessionCookie(nextResponse, sessionToken);

  } catch (error) {
    return createErrorResponse(error, { operation: 'signup' });
  }
}
