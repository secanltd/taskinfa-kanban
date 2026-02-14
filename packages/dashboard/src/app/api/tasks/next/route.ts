// API Route: /api/tasks/next
// Get the highest priority unassigned task across all projects

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query } from '@/lib/db/client';
import { rateLimitApi } from '@/lib/middleware/apiRateLimit';
import type { Task } from '@taskinfa/shared';
import {
  safeJsonParseArray,
  createErrorResponse,
  authenticationError,
} from '@/lib/utils';

interface TaskWithProject extends Task {
  repository_url: string | null;
  project_id: string;
  project_name: string;
}

// GET /api/tasks/next - Get highest priority unassigned task
export async function GET(request: NextRequest) {
  let workspaceId: string | undefined;

  try {
    // Authenticate and rate limit
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;
    workspaceId = auth.workspaceId;

    const db = getDb();

    // Get highest priority unassigned task
    // Priority: urgent > high > medium > low
    // Then by order (top of column first)
    // Then by created_at (oldest first)
    const tasks = await query<TaskWithProject>(db, `
      SELECT
        t.*,
        tl.repository_url,
        tl.id as project_id,
        tl.name as project_name
      FROM tasks t
      JOIN task_lists tl ON t.task_list_id = tl.id
      WHERE t.workspace_id = ?
        AND t.status = 'todo'
        AND (t.assigned_to IS NULL OR t.assigned_to = '')
      ORDER BY
        CASE t.priority
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        t."order" ASC,
        t.created_at ASC
      LIMIT 1
    `, [workspaceId]);

    if (tasks.length === 0) {
      return NextResponse.json({
        task: null,
        project: null,
        message: 'No tasks available',
      });
    }

    const taskRow = tasks[0];

    // Extract project info and clean task object
    const { repository_url, project_id, project_name, ...cleanTask } = taskRow;

    const parsedTask = {
      ...cleanTask,
      labels: safeJsonParseArray<string>(cleanTask.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(cleanTask.files_changed as unknown as string, []),
    };

    return NextResponse.json({
      task: parsedTask,
      project: {
        id: project_id,
        name: project_name,
        repository_url: repository_url,
      },
    });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'get_next_task',
      workspaceId,
    });
  }
}
