// API Route: /api/tasks
// List and create tasks

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
import type { Task, ListTasksRequest, CreateTaskRequest } from '@taskinfa/shared';
import { nanoid } from 'nanoid';

// GET /api/tasks - List tasks
export async function GET(request: NextRequest) {
  // Authenticate
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const limit = parseInt(searchParams.get('limit') || '50');

    const db = getDb();
    let sql = 'SELECT * FROM tasks WHERE workspace_id = ?';
    const params: any[] = [auth.workspaceId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (priority) {
      sql += ' AND priority = ?';
      params.push(priority);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const tasks = await query<Task>(db, sql, params);

    // Parse JSON fields
    const parsedTasks = tasks.map((task) => ({
      ...task,
      labels: JSON.parse(task.labels as any),
      files_changed: JSON.parse(task.files_changed as any),
    }));

    return NextResponse.json({
      tasks: parsedTasks,
      total: tasks.length,
    });
  } catch (error) {
    console.error('Error listing tasks:', error);
    return NextResponse.json(
      { error: 'Failed to list tasks' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create task
export async function POST(request: NextRequest) {
  // Authenticate
  const auth = await authenticateRequest(request);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: CreateTaskRequest = await request.json();
    const { title, description, priority = 'medium', labels = [] } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const taskId = `task_${nanoid()}`;

    await execute(
      db,
      `INSERT INTO tasks (id, workspace_id, title, description, priority, labels, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        auth.workspaceId,
        title,
        description || null,
        priority,
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
      labels: JSON.parse(task[0].labels as any),
      files_changed: JSON.parse(task[0].files_changed as any),
    };

    return NextResponse.json({ task: parsedTask }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
