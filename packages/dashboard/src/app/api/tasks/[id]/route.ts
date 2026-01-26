// API Route: /api/tasks/[id]
// Get, update, and delete individual tasks

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/jwt';
import { getDb, queryOne, execute } from '@/lib/db/client';
import type { Task, UpdateTaskStatusRequest } from '@taskinfa/shared';

// GET /api/tasks/[id] - Get task by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const task = await queryOne<Task>(
      db,
      'SELECT * FROM tasks WHERE id = ? AND workspace_id = ?',
      [params.id, auth.workspaceId]
    );

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const parsedTask = {
      ...task,
      labels: JSON.parse(task.labels as any),
      files_changed: JSON.parse(task.files_changed as any),
    };

    return NextResponse.json({ task: parsedTask });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
      { status: 500 }
    );
  }
}

// PATCH /api/tasks/[id] - Update task status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: UpdateTaskStatusRequest = await request.json();
    const { status, completion_notes, files_changed, error_count, loop_count } = body;

    if (!status) {
      return NextResponse.json(
        { error: 'Status is required' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Build dynamic UPDATE query
    const updates: string[] = ['status = ?', 'updated_at = datetime("now")'];
    const updateParams: any[] = [status];

    // Handle status-specific timestamps
    if (status === 'in_progress') {
      updates.push('started_at = COALESCE(started_at, datetime("now"))');
    } else if (status === 'done' || status === 'review') {
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
      updates.push('error_count = ?');
      updateParams.push(error_count);
    }

    if (loop_count !== undefined) {
      updates.push('loop_count = ?');
      updateParams.push(loop_count);
    }

    updateParams.push(params.id, auth.workspaceId);

    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`;
    await execute(db, sql, updateParams);

    // Fetch updated task
    const task = await queryOne<Task>(
      db,
      'SELECT * FROM tasks WHERE id = ? AND workspace_id = ?',
      [params.id, auth.workspaceId]
    );

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const parsedTask = {
      ...task,
      labels: JSON.parse(task.labels as any),
      files_changed: JSON.parse(task.files_changed as any),
    };

    return NextResponse.json({ task: parsedTask });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

// DELETE /api/tasks/[id] - Delete task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    await execute(
      db,
      'DELETE FROM tasks WHERE id = ? AND workspace_id = ?',
      [params.id, auth.workspaceId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
