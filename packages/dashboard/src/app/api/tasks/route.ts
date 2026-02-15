// API Route: /api/tasks
// List and create tasks

import { NextRequest } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
import { rateLimitApi, jsonWithRateLimit } from '@/lib/middleware/apiRateLimit';
import type { Task, ListTasksRequest, CreateTaskRequest, FeatureKey, FeatureToggle } from '@taskinfa/shared';
import { getValidStatuses } from '@taskinfa/shared';
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

async function getEnabledFeatures(db: ReturnType<typeof getDb>, workspaceId: string): Promise<Record<FeatureKey, boolean>> {
  const rows = await query<FeatureToggle>(
    db,
    'SELECT * FROM feature_toggles WHERE workspace_id = ?',
    [workspaceId]
  );
  const features: Record<FeatureKey, boolean> = { refinement: false, ai_review: false };
  for (const row of rows) {
    if (row.feature_key in features) {
      features[row.feature_key as FeatureKey] = Boolean(row.enabled);
    }
  }
  return features;
}


// GET /api/tasks - List tasks
export async function GET(request: NextRequest) {
  try {
    // Authenticate and rate limit
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const { searchParams } = new URL(request.url);

    // Validate query parameters
    const task_list_id = validateString(searchParams.get('task_list_id'), {
      fieldName: 'task_list_id',
      required: false,
    });

    const db = getDb();
    const enabledFeatures = await getEnabledFeatures(db, auth.workspaceId);
    const validStatuses = getValidStatuses(enabledFeatures);

    const status = validateEnum(searchParams.get('status'),
      validStatuses as readonly string[] as readonly [string, ...string[]],
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

    // Search query (full-text search)
    const q = validateString(searchParams.get('q'), {
      fieldName: 'q',
      required: false,
      maxLength: 200,
    });

    // Label filter
    const label = validateString(searchParams.get('label'), {
      fieldName: 'label',
      required: false,
      maxLength: 100,
    });

    // Assignee filter
    const assignee = validateString(searchParams.get('assignee'), {
      fieldName: 'assignee',
      required: false,
      maxLength: 200,
    });

    // Date range filters
    const created_after = validateString(searchParams.get('created_after'), {
      fieldName: 'created_after',
      required: false,
    });
    const created_before = validateString(searchParams.get('created_before'), {
      fieldName: 'created_before',
      required: false,
    });

    // Sort options
    const sort = validateEnum(searchParams.get('sort'),
      ['created_at', 'updated_at', 'priority', 'title', 'order'] as const,
      { fieldName: 'sort', required: false, defaultValue: 'order' }
    );

    const order = validateEnum(searchParams.get('order'),
      ['asc', 'desc'] as const,
      { fieldName: 'order', required: false, defaultValue: 'asc' }
    );

    let sql = 'SELECT tasks.* FROM tasks';
    const params: (string | number)[] = [];

    // Join FTS table if search query provided
    if (q) {
      sql += ' INNER JOIN tasks_fts ON tasks.id = tasks_fts.task_id';
      sql += ' WHERE tasks_fts MATCH ?';
      const ftsQuery = q.replace(/['"*()^~:]/g, ' ').trim().split(/\s+/).map(w => `"${w}"*`).join(' ');
      params.push(ftsQuery);
      sql += ' AND tasks.workspace_id = ?';
    } else {
      sql += ' WHERE tasks.workspace_id = ?';
    }
    params.push(auth.workspaceId);

    if (task_list_id) {
      sql += ' AND tasks.task_list_id = ?';
      params.push(task_list_id);
    }

    if (status) {
      sql += ' AND tasks.status = ?';
      params.push(status);
    }

    if (priority) {
      sql += ' AND tasks.priority = ?';
      params.push(priority);
    }

    if (label) {
      sql += " AND tasks.labels LIKE ? ESCAPE '\\'";
      const escapedLabel = label.replace(/[%_\\]/g, '\\$&');
      params.push(`%${escapedLabel}%`);
    }

    if (assignee) {
      sql += ' AND (tasks.assignee = ? OR tasks.assigned_to = ?)';
      params.push(assignee, assignee);
    }

    if (created_after) {
      sql += ' AND tasks.created_at >= ?';
      params.push(created_after);
    }

    if (created_before) {
      sql += ' AND tasks.created_at <= ?';
      params.push(created_before);
    }

    // Sort handling — use explicit column map to avoid SQL injection
    const SORT_COLUMNS: Record<string, string> = {
      created_at: 'tasks.created_at',
      updated_at: 'tasks.updated_at',
      title: 'tasks.title',
      order: 'tasks."order"',
      priority: "CASE tasks.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END",
    };
    const sortDir = order === 'desc' ? 'DESC' : 'ASC';
    const sortColumn = SORT_COLUMNS[sort || 'order'];

    if (sort === 'order' || !sort) {
      sql += ` ORDER BY tasks."order" ASC, tasks.created_at ASC`;
    } else if (sort === 'priority') {
      sql += ` ORDER BY ${sortColumn} ${sortDir}, tasks."order" ASC`;
    } else {
      sql += ` ORDER BY ${sortColumn} ${sortDir}`;
    }

    sql += ' LIMIT ?';
    params.push(limit);

    const tasks = await query<Task>(db, sql, params);

    // Parse JSON fields safely
    const parsedTasks = tasks.map((task) => ({
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
    }));

    return jsonWithRateLimit({
      tasks: parsedTasks,
      total: tasks.length,
    }, rl.result);
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
    // Authenticate and rate limit
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

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

    return jsonWithRateLimit({ task: parsedTask }, rl.result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'create_task',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
