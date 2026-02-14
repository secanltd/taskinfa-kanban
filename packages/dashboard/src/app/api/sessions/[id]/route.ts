// API Route: /api/sessions/[id]
// Get and update individual sessions

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, queryOne, execute } from '@/lib/db/client';
import { rateLimitApi } from '@/lib/middleware/apiRateLimit';
import {
  createErrorResponse,
  authenticationError,
  notFoundError,
  validateString,
  validateEnum,
} from '@/lib/utils';
import type { Session, UpdateSessionRequest } from '@taskinfa/shared';

const VALID_STATUSES = ['active', 'idle', 'stuck', 'completed', 'error'] as const;

// GET /api/sessions/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const { id } = await params;
    const db = getDb();

    const session = await queryOne<Session>(
      db,
      `SELECT s.*, tl.name as project_name, t.title as current_task_title
       FROM sessions s
       LEFT JOIN task_lists tl ON s.project_id = tl.id
       LEFT JOIN tasks t ON s.current_task_id = t.id
       WHERE s.id = ? AND s.workspace_id = ?`,
      [id, auth.workspaceId]
    );

    if (!session) {
      throw notFoundError('Session');
    }

    // Get recent events for this session
    const events = await query(
      db,
      `SELECT * FROM session_events WHERE session_id = ? ORDER BY created_at DESC LIMIT 20`,
      [id]
    );

    const parsedEvents = events.map((e: any) => ({
      ...e,
      metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
    }));

    return NextResponse.json({ session, events: parsedEvents });
  } catch (error) {
    return createErrorResponse(error, { operation: 'get_session' });
  }
}

// PATCH /api/sessions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const { id } = await params;
    const body: UpdateSessionRequest = await request.json();

    const db = getDb();

    // Verify session exists and belongs to workspace
    const existing = await queryOne<Session>(
      db,
      'SELECT * FROM sessions WHERE id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    if (!existing) {
      throw notFoundError('Session');
    }

    const updates: string[] = [];
    const values: (string | null)[] = [];

    if (body.status !== undefined) {
      const status = validateEnum(body.status, VALID_STATUSES, {
        fieldName: 'status',
        required: true,
      });
      updates.push('status = ?');
      values.push(status || null);
    }

    if (body.current_task_id !== undefined) {
      updates.push('current_task_id = ?');
      values.push(body.current_task_id);
    }

    if (body.summary !== undefined) {
      const summary = validateString(body.summary, {
        fieldName: 'summary',
        required: false,
        maxLength: 2000,
      });
      updates.push('summary = ?');
      values.push(summary || null);
    }

    if (body.last_event_at !== undefined) {
      updates.push('last_event_at = ?');
      values.push(body.last_event_at);
    }

    if (updates.length === 0) {
      return NextResponse.json({ session: existing });
    }

    updates.push("updated_at = datetime('now')");
    values.push(id, auth.workspaceId);

    await execute(
      db,
      `UPDATE sessions SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`,
      values
    );

    const updated = await queryOne<Session>(
      db,
      'SELECT * FROM sessions WHERE id = ?',
      [id]
    );

    return NextResponse.json({ session: updated });
  } catch (error) {
    return createErrorResponse(error, { operation: 'update_session' });
  }
}
