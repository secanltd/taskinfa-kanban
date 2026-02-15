import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, execute, queryOne } from '@/lib/db/client';
import {
  createErrorResponse,
  authenticationError,
  notFoundError,
} from '@/lib/utils';

// DELETE /api/saved-filters/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) throw authenticationError();

    const { id } = await params;
    const db = getDb();

    const existing = await queryOne(
      db,
      'SELECT id FROM saved_filters WHERE id = ? AND workspace_id = ? AND user_id = ?',
      [id, auth.workspaceId, auth.userId || '']
    );

    if (!existing) throw notFoundError('Saved filter not found');

    await execute(
      db,
      'DELETE FROM saved_filters WHERE id = ? AND workspace_id = ? AND user_id = ?',
      [id, auth.workspaceId, auth.userId || '']
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error, { operation: 'delete_saved_filter' });
  }
}
