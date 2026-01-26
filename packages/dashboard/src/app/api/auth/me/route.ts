import { NextRequest, NextResponse } from 'next/server';
import { getDb, queryOne } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth/middleware';
import type { GetMeResponse, User, Workspace } from '@taskinfa/shared';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    // Verify session authentication
    const session = await requireAuth(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const db = getDb();

    // Fetch user
    const user = await queryOne<User>(
      db,
      'SELECT * FROM users WHERE id = ?',
      [session.userId]
    );

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch workspace
    const workspace = await queryOne<Workspace>(
      db,
      'SELECT * FROM workspaces WHERE id = ?',
      [user.workspace_id]
    );

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Prepare response without password_hash
    const { password_hash, ...userWithoutPassword } = user;
    const response: GetMeResponse = {
      user: {
        ...userWithoutPassword,
        is_verified: Boolean(userWithoutPassword.is_verified),
        is_active: Boolean(userWithoutPassword.is_active),
      },
      workspace,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Get me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
