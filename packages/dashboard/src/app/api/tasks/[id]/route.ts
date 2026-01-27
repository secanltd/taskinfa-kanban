// API Route: /api/tasks/[id]
// Get, update, and delete individual tasks

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, queryOne, execute } from '@/lib/db/client';
import type { Task, UpdateTaskStatusRequest } from '@taskinfa/shared';
import {
  safeJsonParseArray,
  createErrorResponse,
  authenticationError,
  notFoundError,
  validationError,
  validateEnum,
  validateInteger,
} from '@/lib/utils';


// GET /api/tasks/[id] - Get task by ID
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
    const task = await queryOne<Task>(
      db,
      'SELECT * FROM tasks WHERE id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    if (!task) {
      throw notFoundError('Task');
    }

    const parsedTask = {
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
    };

    return NextResponse.json({ task: parsedTask });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'get_task',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}

// PATCH /api/tasks/[id] - Update task status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const { id } = await params;

    const body: UpdateTaskStatusRequest = await request.json();
    const { status, completion_notes, files_changed, error_count, loop_count, assigned_to } = body;

    // Validate status if provided
    const validatedStatus = status ? validateEnum(status,
      ['backlog', 'todo', 'in_progress', 'review', 'done'] as const,
      { fieldName: 'status', required: false }
    ) : undefined;

    const db = getDb();

    // Build dynamic UPDATE query
    const updates: string[] = ['updated_at = datetime("now")'];
    const updateParams: (string | number | null)[] = [];

    if (validatedStatus) {
      updates.push('status = ?');
      updateParams.push(validatedStatus);
    }

    // Handle status-specific timestamps
    if (validatedStatus === 'in_progress') {
      updates.push('started_at = COALESCE(started_at, datetime("now"))');
    } else if (validatedStatus === 'done' || validatedStatus === 'review') {
      updates.push('completed_at = COALESCE(completed_at, datetime("now"))');
    }

    if (completion_notes !== undefined) {
      updates.push('completion_notes = ?');
      updateParams.push(completion_notes);
    }

    if (files_changed !== undefined) {
      updates.push('files_changed = ?');
      updateParams.push(JSON.stringify(files_changed));
    }

    if (error_count !== undefined) {
      const validatedErrorCount = validateInteger(String(error_count), {
        fieldName: 'error_count',
        min: 0,
        defaultValue: 0,
      });
      updates.push('error_count = ?');
      updateParams.push(validatedErrorCount);
    }

    if (loop_count !== undefined) {
      const validatedLoopCount = validateInteger(String(loop_count), {
        fieldName: 'loop_count',
        min: 0,
        defaultValue: 0,
      });
      updates.push('loop_count = ?');
      updateParams.push(validatedLoopCount);
    }

    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      updateParams.push(assigned_to || null);
    }

    updateParams.push(id, auth.workspaceId);

    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`;
    await execute(db, sql, updateParams);

    // Fetch updated task
    const task = await queryOne<Task>(
      db,
      'SELECT * FROM tasks WHERE id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    if (!task) {
      throw notFoundError('Task');
    }

    const parsedTask = {
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
    };

    return NextResponse.json({ task: parsedTask });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'update_task',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}

// DELETE /api/tasks/[id] - Delete task
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

    const db = getDb();
    await execute(
      db,
      'DELETE FROM tasks WHERE id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'delete_task',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
