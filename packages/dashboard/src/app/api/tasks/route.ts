// API Route: /api/tasks
// List and create tasks

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/jwt';
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
    const auth = await authenticateRequest(request);
    if (!auth) {
      throw authenticationError();
    }

    const { searchParams } = new URL(request.url);

    // Validate query parameters
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

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
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
      workspaceId: (await authenticateRequest(request))?.workspaceId,
    });
  }
}

// POST /api/tasks - Create task
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequest(request);
    if (!auth) {
      throw authenticationError();
    }

    const body: CreateTaskRequest = await request.json();
    const { title, description, priority = 'medium', labels = [] } = body;

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
    const taskId = `task_${nanoid()}`;

    await execute(
      db,
      `INSERT INTO tasks (id, workspace_id, title, description, priority, labels, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        auth.workspaceId,
        validatedTitle,
        validatedDescription || null,
        validatedPriority || 'medium',
        JSON.stringify(labels),
        'todo',
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
      workspaceId: (await authenticateRequest(request))?.workspaceId,
    });
  }
}
