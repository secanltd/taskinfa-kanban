// API Route: /api/tasks/[id]/dependencies
// Manage task dependencies (blocked-by relationships)

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
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
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
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

    // Check for circular dependency: does depends_on_task_id already depend on id?
    const circular = await query<TaskDependency>(
      db,
      `WITH RECURSIVE dep_chain(task_id) AS (
        SELECT task_id FROM task_dependencies WHERE depends_on_task_id = ? AND workspace_id = ?
        UNION
        SELECT td.task_id FROM task_dependencies td JOIN dep_chain dc ON td.depends_on_task_id = dc.task_id WHERE td.workspace_id = ?
      )
      SELECT task_id FROM dep_chain WHERE task_id = ?`,
      [id, auth.workspaceId, auth.workspaceId, depends_on_task_id]
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
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
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
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
