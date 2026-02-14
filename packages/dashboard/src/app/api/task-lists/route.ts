// API Route: /api/task-lists
// List and create task lists (projects)

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
import { rateLimitApi } from '@/lib/middleware/apiRateLimit';
import type { TaskList } from '@taskinfa/shared';
import { nanoid } from 'nanoid';
import {
  createErrorResponse,
  authenticationError,
  validationError,
  validateString,
} from '@/lib/utils';

// GET /api/task-lists - List task lists
export async function GET(request: NextRequest) {
  try {
    // Authenticate and rate limit
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const db = getDb();
    const taskLists = await query<TaskList>(
      db,
      'SELECT * FROM task_lists WHERE workspace_id = ? ORDER BY created_at DESC',
      [auth.workspaceId]
    );

    return NextResponse.json({
      task_lists: taskLists,
      total: taskLists.length,
    });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'list_task_lists',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}

// POST /api/task-lists - Create task list
export async function POST(request: NextRequest) {
  try {
    // Authenticate and rate limit
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const body: any = await request.json();
    const { name, description, repository_url, working_directory = '/workspace' } = body;

    // Validate inputs
    const validatedName = validateString(name, {
      fieldName: 'name',
      required: true,
      minLength: 1,
      maxLength: 200,
    });

    if (!validatedName) {
      throw validationError('Name is required');
    }

    const validatedDescription = validateString(description, {
      fieldName: 'description',
      required: false,
      maxLength: 1000,
    });

    const validatedRepoUrl = validateString(repository_url, {
      fieldName: 'repository_url',
      required: false,
      maxLength: 500,
    });

    const validatedWorkingDir = validateString(working_directory, {
      fieldName: 'working_directory',
      required: false,
      maxLength: 500,
    }) || '/workspace';

    const db = getDb();

    // Generate task list ID from name (kebab-case)
    const baseId = validatedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if ID already exists
    const existingTaskList = await query<TaskList>(
      db,
      'SELECT id FROM task_lists WHERE id = ? AND workspace_id = ?',
      [baseId, auth.workspaceId]
    );

    let taskListId = baseId;
    if (existingTaskList.length > 0) {
      // Add random suffix if ID exists
      taskListId = `${baseId}-${nanoid(6)}`;
    }

    await execute(
      db,
      `INSERT INTO task_lists (id, workspace_id, name, description, repository_url, working_directory)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        taskListId,
        auth.workspaceId,
        validatedName,
        validatedDescription || null,
        validatedRepoUrl || null,
        validatedWorkingDir,
      ]
    );

    // Fetch created task list
    const taskList = await query<TaskList>(
      db,
      'SELECT * FROM task_lists WHERE id = ?',
      [taskListId]
    );

    if (!taskList[0]) {
      throw new Error('Failed to create task list');
    }

    return NextResponse.json({ task_list: taskList[0] }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'create_task_list',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
