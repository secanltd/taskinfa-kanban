// API Route: /api/tasks
// List and create tasks

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
import type { Task, ListTasksRequest, CreateTaskRequest } from '@taskinfa/shared';
import { nanoid } from 'nanoid';
import {
  safeJsonParseArray,
  createErrorResponse,
  authenticationError,
  validationError,
  validateInteger,
  validateEnum,
  validateString,
} from '@/lib/utils';


// GET /api/tasks - List tasks
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const task_list_id = validateString(searchParams.get('task_list_id'), {
      fieldName: 'task_list_id',
      required: false,
    });

    const status = validateEnum(searchParams.get('status'),
      ['backlog', 'todo', 'in_progress', 'review', 'done'] as const,
      { fieldName: 'status', required: false }
    );

    const priority = validateEnum(searchParams.get('priority'),
      ['low', 'medium', 'high', 'urgent'] as const,
      { fieldName: 'priority', required: false }
    );

    const limit = validateInteger(searchParams.get('limit'), {
      fieldName: 'limit',
      min: 1,
      max: 100,
      defaultValue: 50,
    });

    const db = getDb();
    let sql = 'SELECT * FROM tasks WHERE workspace_id = ?';
    const params: string[] = [auth.workspaceId];

    if (task_list_id) {
      sql += ' AND task_list_id = ?';
      params.push(task_list_id);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY "order" ASC, created_at ASC LIMIT ?';
    params.push(String(limit));

    const tasks = await query<Task>(db, sql, params);

    // Parse JSON fields safely
    const parsedTasks = tasks.map((task) => ({
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
    }));

    return NextResponse.json({
      tasks: parsedTasks,
      total: tasks.length,
    });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'list_tasks',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}

// POST /api/tasks - Create task
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const body: CreateTaskRequest = await request.json();
    const { title, description, priority = 'medium', labels = [], task_list_id } = body;

    // Validate inputs
    const validatedTitle = validateString(title, {
      fieldName: 'title',
      required: true,
      minLength: 1,
      maxLength: 500,
    });

    if (!validatedTitle) {
      throw validationError('Title is required');
    }

    const validatedTaskListId = validateString(task_list_id, {
      fieldName: 'task_list_id',
      required: true,
      minLength: 1,
      maxLength: 200,
    });

    if (!validatedTaskListId) {
      throw validationError('Task list ID is required');
    }

    const validatedDescription = validateString(description, {
      fieldName: 'description',
      required: false,
      maxLength: 5000,
    });

    const validatedPriority = validateEnum(priority,
      ['low', 'medium', 'high', 'urgent'] as const,
      { fieldName: 'priority', defaultValue: 'medium' }
    );

    const db = getDb();

    // Verify task list exists and belongs to user
    const taskList = await query(
      db,
      'SELECT id FROM task_lists WHERE id = ? AND workspace_id = ?',
      [validatedTaskListId, auth.workspaceId]
    );

    if (taskList.length === 0) {
      throw validationError('Task list not found');
    }

    // Get next order number for this task list and status
    const maxOrderResult = await query<{ max_order: number }>(
      db,
      'SELECT COALESCE(MAX("order"), -1) as max_order FROM tasks WHERE task_list_id = ? AND status = ?',
      [validatedTaskListId, 'backlog']
    );

    const nextOrder = (maxOrderResult[0]?.max_order ?? -1) + 1;

    const taskId = `task_${nanoid()}`;

    await execute(
      db,
      `INSERT INTO tasks (id, workspace_id, task_list_id, title, description, priority, labels, status, "order")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        auth.workspaceId,
        validatedTaskListId,
        validatedTitle,
        validatedDescription || null,
        validatedPriority || 'medium',
        JSON.stringify(labels),
        'backlog',
        nextOrder,
      ]
    );

    // Fetch created task
    const task = await query<Task>(
      db,
      'SELECT * FROM tasks WHERE id = ?',
      [taskId]
    );

    if (!task[0]) {
      throw new Error('Failed to create task');
    }

    const parsedTask = {
      ...task[0],
      labels: safeJsonParseArray<string>(task[0].labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task[0].files_changed as unknown as string, []),
    };

    return NextResponse.json({ task: parsedTask }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'create_task',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
