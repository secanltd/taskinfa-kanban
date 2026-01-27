import { NextRequest, NextResponse } from 'next/server';
import { getDb, execute, queryOne } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth/middleware';
import type { UpdateApiKeyRequest, UpdateApiKeyResponse, ApiKey } from '@taskinfa/shared';


// DELETE /api/keys/[id] - Soft delete (revoke) API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify session authentication
    const session = await requireAuth(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const db = getDb();

    // Verify key exists and belongs to user
    const key = await queryOne<ApiKey>(
      db,
      'SELECT id, user_id FROM api_keys WHERE id = ?',
      [id]
    );

    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (key.user_id !== session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized to delete this API key' },
        { status: 403 }
      );
    }

    // Soft delete by setting is_active to 0
    await execute(
      db,
      'UPDATE api_keys SET is_active = 0 WHERE id = ?',
      [id]
    );

    return NextResponse.json(
      { success: true, message: 'API key revoked successfully' },
      { status: 200 }
    );

  } catch (error) {
    console.error('Delete API key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/keys/[id] - Update API key (rename)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify session authentication
    const session = await requireAuth(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body: UpdateApiKeyRequest = await request.json();
    const { name } = body;

    // Validate name
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'API key name must be less than 100 characters' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Verify key exists and belongs to user
    const key = await queryOne<ApiKey>(
      db,
      'SELECT id, user_id, is_active FROM api_keys WHERE id = ?',
      [id]
    );

    if (!key) {
      return NextResponse.json(
        { error: 'API key not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (key.user_id !== session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized to update this API key' },
        { status: 403 }
      );
    }

    // Check if key is active
    if (!key.is_active) {
      return NextResponse.json(
        { error: 'Cannot update a revoked API key' },
        { status: 400 }
      );
    }

    // Update key name
    await execute(
      db,
      'UPDATE api_keys SET name = ? WHERE id = ?',
      [name.trim(), id]
    );

    const response: UpdateApiKeyResponse = {
      success: true,
      key: {
        id,
        name: name.trim(),
      },
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Update API key error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
