// API Route: /api/sessions
// CRUD for Claude Code sessions

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
import { rateLimitApi } from '@/lib/middleware/apiRateLimit';
import { nanoid } from 'nanoid';
import {
  createErrorResponse,
  authenticationError,
  validationError,
  validateString,
  validateEnum,
} from '@/lib/utils';
import type { SessionStatus, SessionWithDetails, CreateSessionRequest } from '@taskinfa/shared';

const VALID_STATUSES = ['active', 'idle', 'stuck', 'completed', 'error'] as const;

// GET /api/sessions — list sessions
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const { searchParams } = new URL(request.url);
    const status = validateEnum(searchParams.get('status'), VALID_STATUSES, {
      fieldName: 'status',
      required: false,
    });
    const projectId = searchParams.get('project_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const db = getDb();
    let sql = `
      SELECT s.*,
        tl.name as project_name,
        t.title as current_task_title
      FROM sessions s
      LEFT JOIN task_lists tl ON s.project_id = tl.id
      LEFT JOIN tasks t ON s.current_task_id = t.id
      WHERE s.workspace_id = ?
    `;
    const params: (string | number)[] = [auth.workspaceId];

    if (status) {
      sql += ' AND s.status = ?';
      params.push(status);
    }
    if (projectId) {
      sql += ' AND s.project_id = ?';
      params.push(projectId);
    }

    sql += ' ORDER BY s.started_at DESC LIMIT ?';
    params.push(limit);

    const sessions = await query<SessionWithDetails>(db, sql, params);

    // Compute stats
    const allSessions = await query<{ status: string }>(
      db,
      'SELECT status FROM sessions WHERE workspace_id = ?',
      [auth.workspaceId]
    );

    const stats = {
      active: 0, idle: 0, stuck: 0, completed: 0, error: 0,
    };
    for (const s of allSessions) {
      if (s.status in stats) {
        stats[s.status as keyof typeof stats]++;
      }
    }

    return NextResponse.json({ sessions, stats });
  } catch (error) {
    return createErrorResponse(error, { operation: 'list_sessions' });
  }
}

// POST /api/sessions — create a new session
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const body: CreateSessionRequest = await request.json();

    const status = validateEnum(body.status, VALID_STATUSES, {
      fieldName: 'status',
      required: false,
      defaultValue: 'active',
    }) as SessionStatus || 'active';

    const projectId = validateString(body.project_id, {
      fieldName: 'project_id',
      required: false,
    });

    const currentTaskId = validateString(body.current_task_id, {
      fieldName: 'current_task_id',
      required: false,
    });

    const summary = validateString(body.summary, {
      fieldName: 'summary',
      required: false,
      maxLength: 2000,
    });

    const db = getDb();
    const sessionId = `ses_${nanoid()}`;

    await execute(
      db,
      `INSERT INTO sessions (id, workspace_id, project_id, current_task_id, status, summary, started_at, last_event_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'), datetime('now'))`,
      [sessionId, auth.workspaceId, projectId || null, currentTaskId || null, status, summary || null]
    );

    const session = await query(db, 'SELECT * FROM sessions WHERE id = ?', [sessionId]);

    return NextResponse.json({ session: session[0] }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, { operation: 'create_session' });
  }
}
