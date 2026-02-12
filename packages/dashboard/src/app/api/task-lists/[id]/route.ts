// API Route: /api/task-lists/[id]
// Get, update, and delete task lists

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
import type { TaskList } from '@taskinfa/shared';
import {
  createErrorResponse,
  authenticationError,
  notFoundError,
  validateString,
} from '@/lib/utils';

// GET /api/task-lists/[id] - Get task list
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const params = await segmentData.params;
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const db = getDb();
    const taskList = await query<TaskList>(
      db,
      'SELECT * FROM task_lists WHERE id = ? AND workspace_id = ?',
      [params.id, auth.workspaceId]
    );

    if (!taskList[0]) {
      throw notFoundError('Task list not found');
    }

    return NextResponse.json({ task_list: taskList[0] });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'get_task_list',
    });
  }
}

// PATCH /api/task-lists/[id] - Update task list
export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const params = await segmentData.params;
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const db = getDb();

    // Check if task list exists and belongs to user
    const existingTaskList = await query<TaskList>(
      db,
      'SELECT * FROM task_lists WHERE id = ? AND workspace_id = ?',
      [params.id, auth.workspaceId]
    );

    if (!existingTaskList[0]) {
      throw notFoundError('Task list not found');
    }

    const body: any = await request.json();
    const { name, description, repository_url, working_directory, is_initialized } = body;

    // Build dynamic UPDATE query
    const updates: string[] = ['updated_at = datetime("now")'];
    const updateParams: (string | null)[] = [];

    if (name !== undefined) {
      const validatedName = validateString(name, {
        fieldName: 'name',
        required: true,
        minLength: 1,
        maxLength: 200,
      });
      updates.push('name = ?');
      updateParams.push(validatedName);
    }

    if (description !== undefined) {
      const validatedDescription = validateString(description, {
        fieldName: 'description',
        required: false,
        maxLength: 1000,
      });
      updates.push('description = ?');
      updateParams.push(validatedDescription || null);
    }

    if (repository_url !== undefined) {
      const validatedRepoUrl = validateString(repository_url, {
        fieldName: 'repository_url',
        required: false,
        maxLength: 500,
      });
      updates.push('repository_url = ?');
      updateParams.push(validatedRepoUrl || null);
    }

    if (working_directory !== undefined) {
      const validatedWorkingDir = validateString(working_directory, {
        fieldName: 'working_directory',
        required: false,
        maxLength: 500,
      });
      updates.push('working_directory = ?');
      updateParams.push(validatedWorkingDir || '/workspace');
    }

    if (is_initialized !== undefined) {
      updates.push('is_initialized = ?');
      updateParams.push(is_initialized ? '1' : '0');
    }

    updateParams.push(params.id, auth.workspaceId);

    const sql = `UPDATE task_lists SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`;
    await execute(db, sql, updateParams);

    // Fetch updated task list
    const taskList = await query<TaskList>(
      db,
      'SELECT * FROM task_lists WHERE id = ?',
      [params.id]
    );

    return NextResponse.json({ task_list: taskList[0] });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'update_task_list',
    });
  }
}

// DELETE /api/task-lists/[id] - Delete task list
export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const params = await segmentData.params;
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const db = getDb();

    // Check if task list exists and belongs to user
    const existingTaskList = await query<TaskList>(
      db,
      'SELECT * FROM task_lists WHERE id = ? AND workspace_id = ?',
      [params.id, auth.workspaceId]
    );

    if (!existingTaskList[0]) {
      throw notFoundError('Task list not found');
    }

    // Check if there are tasks assigned to this task list
    const tasksCount = await query<{ count: number }>(
      db,
      'SELECT COUNT(*) as count FROM tasks WHERE task_list_id = ?',
      [params.id]
    );

    if (tasksCount[0]?.count > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete task list with existing tasks',
          message: `This task list has ${tasksCount[0].count} task(s). Please delete or reassign them first.`
        },
        { status: 400 }
      );
    }

    await execute(
      db,
      'DELETE FROM task_lists WHERE id = ? AND workspace_id = ?',
      [params.id, auth.workspaceId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'delete_task_list',
    });
  }
}
