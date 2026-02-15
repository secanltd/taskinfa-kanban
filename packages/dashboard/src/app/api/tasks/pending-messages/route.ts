// API Route: /api/tasks/pending-messages
// Returns tasks that have unprocessed user comments (for async chat)

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query } from '@/lib/db/client';
import { rateLimitApi } from '@/lib/middleware/apiRateLimit';
import type { Task } from '@taskinfa/shared';
import {
  createErrorResponse,
  authenticationError,
  safeJsonParseArray,
} from '@/lib/utils';

// GET /api/tasks/pending-messages - Get tasks with unprocessed user messages
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const db = getDb();

    // Find tasks where the latest comment is from a user (author_type = 'user')
    // and there's no newer bot comment — meaning the message is unprocessed
    const tasks = await query<Task>(
      db,
      `SELECT t.* FROM tasks t
       JOIN task_comments c ON c.task_id = t.id
       WHERE c.author_type = 'user'
       AND c.created_at = (
         SELECT MAX(c2.created_at) FROM task_comments c2 WHERE c2.task_id = t.id
       )
       AND t.workspace_id = ?
       ORDER BY c.created_at ASC`,
      [auth.workspaceId]
    );

    const parsedTasks = tasks.map(t => ({
      ...t,
      labels: safeJsonParseArray<string>(t.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(t.files_changed as unknown as string, []),
    }));

    return NextResponse.json({ tasks: parsedTasks });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'pending_messages',
    });
  }
}
