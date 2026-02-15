// API Route: /api/tasks/bulk
// Bulk update and delete tasks

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
import type { Task } from '@taskinfa/shared';
import {
  safeJsonParseArray,
  createErrorResponse,
  authenticationError,
  validationError,
  validateEnum,
  validateArray,
} from '@/lib/utils';

const MAX_BULK_SIZE = 50;

function parseTasks(tasks: Task[]): Task[] {
  return tasks.map((task) => ({
    ...task,
    labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
    files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
  }));
}

// PATCH /api/tasks/bulk - Bulk update tasks
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const body = await request.json() as { task_ids: string[]; update: Record<string, unknown> };
    const { task_ids, update } = body;

    // Validate task_ids
    const validatedIds = validateArray(task_ids, {
      fieldName: 'task_ids',
      required: true,
      minLength: 1,
      maxLength: MAX_BULK_SIZE,
    });

    if (!validatedIds || validatedIds.length === 0) {
      throw validationError('task_ids must be a non-empty array');
    }

    // Validate each ID is a non-empty string
    for (const id of validatedIds) {
      if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
        throw validationError('Each task_id must be a non-empty string (max 100 chars)');
      }
    }

    if (!update || typeof update !== 'object') {
      throw validationError('update payload is required');
    }

    const { status, priority, labels, assigned_to } = update as {
      status?: string;
      priority?: string;
      labels?: string[];
      assigned_to?: string | null;
    };

    // Validate update fields
    const validatedStatus = status ? validateEnum(status,
      ['backlog', 'todo', 'in_progress', 'review', 'done'] as const,
      { fieldName: 'status', required: false }
    ) : undefined;

    const validatedPriority = priority ? validateEnum(priority,
      ['low', 'medium', 'high', 'urgent'] as const,
      { fieldName: 'priority', required: false }
    ) : undefined;

    // Build dynamic UPDATE query
    const updates: string[] = ['updated_at = datetime("now")'];
    const updateParams: (string | number | null)[] = [];

    if (validatedStatus) {
      updates.push('status = ?');
      updateParams.push(validatedStatus);

      if (validatedStatus === 'in_progress') {
        updates.push('started_at = COALESCE(started_at, datetime("now"))');
      } else if (validatedStatus === 'done' || validatedStatus === 'review') {
        updates.push('completed_at = COALESCE(completed_at, datetime("now"))');
      }
    }

    if (validatedPriority) {
      updates.push('priority = ?');
      updateParams.push(validatedPriority);
    }

    if (labels !== undefined) {
      updates.push('labels = ?');
      updateParams.push(JSON.stringify(labels));
    }

    if (assigned_to !== undefined) {
      updates.push('assigned_to = ?');
      updateParams.push(assigned_to || null);
    }

    if (updates.length === 1) {
      throw validationError('At least one update field is required');
    }

    const db = getDb();

    // Build placeholders for IN clause
    const placeholders = validatedIds.map(() => '?').join(', ');
    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id IN (${placeholders}) AND workspace_id = ?`;
    const params = [...updateParams, ...validatedIds, auth.workspaceId];

    await execute(db, sql, params);

    // Fetch updated tasks
    const fetchSql = `SELECT * FROM tasks WHERE id IN (${placeholders}) AND workspace_id = ?`;
    const fetchParams = [...validatedIds, auth.workspaceId];
    const updatedTasks = await query<Task>(db, fetchSql, fetchParams);

    return NextResponse.json({
      updated: updatedTasks.length,
      tasks: parseTasks(updatedTasks),
    });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'bulk_update_tasks',
    });
  }
}

// DELETE /api/tasks/bulk - Bulk delete tasks
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const body = await request.json() as { task_ids: string[] };
    const { task_ids } = body;

    const validatedIds = validateArray(task_ids, {
      fieldName: 'task_ids',
      required: true,
      minLength: 1,
      maxLength: MAX_BULK_SIZE,
    });

    if (!validatedIds || validatedIds.length === 0) {
      throw validationError('task_ids must be a non-empty array');
    }

    // Validate each ID is a non-empty string
    for (const id of validatedIds) {
      if (typeof id !== 'string' || id.length === 0 || id.length > 100) {
        throw validationError('Each task_id must be a non-empty string (max 100 chars)');
      }
    }

    const db = getDb();
    const placeholders = validatedIds.map(() => '?').join(', ');

    // Count matching tasks before delete to return accurate count
    const countResult = await query<{ count: number }>(
      db,
      `SELECT COUNT(*) as count FROM tasks WHERE id IN (${placeholders}) AND workspace_id = ?`,
      [...validatedIds, auth.workspaceId]
    );
    const matchCount = countResult[0]?.count ?? 0;

    const sql = `DELETE FROM tasks WHERE id IN (${placeholders}) AND workspace_id = ?`;
    const params = [...validatedIds, auth.workspaceId];

    await execute(db, sql, params);

    return NextResponse.json({ deleted: matchCount });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'bulk_delete_tasks',
    });
  }
}
