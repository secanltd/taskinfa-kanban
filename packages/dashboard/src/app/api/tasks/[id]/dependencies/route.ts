// API Route: /api/tasks/[id]/dependencies
// Manage task dependencies (blocked-by relationships)

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
import { rateLimitApi } from '@/lib/middleware/apiRateLimit';
import type { TaskDependency, Task } from '@taskinfa/shared';
import { nanoid } from 'nanoid';
import {
  createErrorResponse,
  authenticationError,
  notFoundError,
  validationError,
} from '@/lib/utils';

// GET /api/tasks/[id]/dependencies - List dependencies for a task
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

    // Verify task exists and belongs to workspace
    const task = await query<Task>(
      db,
      'SELECT id FROM tasks WHERE id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    if (task.length === 0) {
      throw notFoundError('Task');
    }

    // Get dependencies with the depended-on task details
    const dependencies = await query<TaskDependency>(
      db,
      'SELECT * FROM task_dependencies WHERE task_id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    // Get the blocked-by task details
    const blockedBy = dependencies.length > 0
      ? await query<{ id: string; title: string; status: string }>(
          db,
          `SELECT id, title, status FROM tasks WHERE id IN (${dependencies.map(() => '?').join(',')}) AND workspace_id = ?`,
          [...dependencies.map(d => d.depends_on_task_id), auth.workspaceId]
        )
      : [];

    return NextResponse.json({
      dependencies,
      blocked_by: blockedBy,
    });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'list_dependencies',
    });
  }
}

// POST /api/tasks/[id]/dependencies - Add a dependency
export async function POST(
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
    const body = await request.json() as { depends_on_task_id?: string };
    const { depends_on_task_id } = body;

    if (!depends_on_task_id) {
      throw validationError('depends_on_task_id is required');
    }

    if (id === depends_on_task_id) {
      throw validationError('A task cannot depend on itself');
    }

    const db = getDb();

    // Verify both tasks exist and belong to the same workspace
    const tasks = await query<Task>(
      db,
      'SELECT id FROM tasks WHERE id IN (?, ?) AND workspace_id = ?',
      [id, depends_on_task_id, auth.workspaceId]
    );

    if (tasks.length < 2) {
      throw notFoundError('One or both tasks');
    }

    // Check for circular dependency: adding "id depends on depends_on_task_id"
    // would create a cycle if id is reachable from depends_on_task_id via existing deps.
    // Start from depends_on_task_id and follow the chain forward.
    const circular = await query<{ tid: string }>(
      db,
      `WITH RECURSIVE dep_chain(tid) AS (
        SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ? AND workspace_id = ?
        UNION
        SELECT td.depends_on_task_id FROM task_dependencies td JOIN dep_chain dc ON td.task_id = dc.tid WHERE td.workspace_id = ?
      )
      SELECT tid FROM dep_chain WHERE tid = ?`,
      [depends_on_task_id, auth.workspaceId, auth.workspaceId, id]
    );

    if (circular.length > 0) {
      throw validationError('Adding this dependency would create a circular dependency');
    }

    // Check if dependency already exists
    const existing = await query<TaskDependency>(
      db,
      'SELECT id FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ? AND workspace_id = ?',
      [id, depends_on_task_id, auth.workspaceId]
    );

    if (existing.length > 0) {
      throw validationError('This dependency already exists');
    }

    const depId = `dep_${nanoid()}`;

    await execute(
      db,
      `INSERT INTO task_dependencies (id, task_id, depends_on_task_id, workspace_id)
       VALUES (?, ?, ?, ?)`,
      [depId, id, depends_on_task_id, auth.workspaceId]
    );

    const dependency = await query<TaskDependency>(
      db,
      'SELECT * FROM task_dependencies WHERE id = ?',
      [depId]
    );

    return NextResponse.json({ dependency: dependency[0] }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'add_dependency',
    });
  }
}

// DELETE /api/tasks/[id]/dependencies - Remove a dependency
export async function DELETE(
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
    const { searchParams } = new URL(request.url);
    const dependsOnTaskId = searchParams.get('depends_on_task_id');

    if (!dependsOnTaskId) {
      throw validationError('depends_on_task_id query parameter is required');
    }

    const db = getDb();

    await execute(
      db,
      'DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ? AND workspace_id = ?',
      [id, dependsOnTaskId, auth.workspaceId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'remove_dependency',
    });
  }
}
