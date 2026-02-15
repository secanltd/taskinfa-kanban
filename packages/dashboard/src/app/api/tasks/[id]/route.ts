// API Route: /api/tasks/[id]
// Get, update, and delete individual tasks

import { NextRequest } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, queryOne, query, execute } from '@/lib/db/client';
import { rateLimitApi, jsonWithRateLimit } from '@/lib/middleware/apiRateLimit';
import type { Task, TaskDependency, UpdateTaskStatusRequest, FeatureKey, FeatureToggle } from '@taskinfa/shared';
import { getValidStatuses } from '@taskinfa/shared';
import {
  safeJsonParseArray,
  createErrorResponse,
  authenticationError,
  notFoundError,
  validationError,
  validateEnum,
  validateInteger,
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
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

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

    // Get subtasks
    const subtasks = await query<Task>(
      db,
      'SELECT * FROM tasks WHERE parent_task_id = ? AND workspace_id = ? ORDER BY "order" ASC',
      [id, auth.workspaceId]
    );

    const parsedSubtasks = subtasks.map(st => ({
      ...st,
      labels: safeJsonParseArray<string>(st.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(st.files_changed as unknown as string, []),
    }));

    // Get dependencies
    const dependencies = await query<TaskDependency>(
      db,
      'SELECT * FROM task_dependencies WHERE task_id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    // Check if blocked (any dependency not done)
    let is_blocked = false;
    if (dependencies.length > 0) {
      const blockedCheck = await query<{ cnt: number }>(
        db,
        `SELECT COUNT(*) as cnt FROM task_dependencies td
         JOIN tasks t ON td.depends_on_task_id = t.id
         WHERE td.task_id = ? AND t.status != 'done'`,
        [id]
      );
      is_blocked = (blockedCheck[0]?.cnt ?? 0) > 0;
    }

    const parsedTask = {
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
      subtask_count: subtasks.length,
      subtask_done_count: subtasks.filter(st => st.status === 'done').length,
      subtasks: parsedSubtasks,
      dependencies,
      is_blocked,
    };

    return jsonWithRateLimit({ task: parsedTask }, rl.result);
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'get_task',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}

// Extended update request interface for dashboard editing
interface UpdateTaskRequest extends UpdateTaskStatusRequest {
  title?: string;
  description?: string;
  priority?: string;
  labels?: string[];
  pr_url?: string;
  branch_name?: string;
}

// PATCH /api/tasks/[id] - Update task
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const { id } = await params;

    const body: UpdateTaskRequest = await request.json();
    const {
      status,
      completion_notes,
      files_changed,
      error_count,
      loop_count,
      assigned_to,
      title,
      description,
      priority,
      labels,
      pr_url,
      branch_name,
    } = body;

    // Validate status dynamically based on enabled feature toggles
    const db = getDb();
    const enabledFeatures = await getEnabledFeatures(db, auth.workspaceId);
    const validStatuses = getValidStatuses(enabledFeatures);

    const validatedStatus = status ? validateEnum(status,
      validStatuses,
      { fieldName: 'status', required: false }
    ) : undefined;

    // Validate priority if provided
    const validatedPriority = priority ? validateEnum(priority,
      ['low', 'medium', 'high', 'urgent'] as const,
      { fieldName: 'priority', required: false }
    ) : undefined;

    // Build dynamic UPDATE query
    const updates: string[] = ['updated_at = datetime("now")'];
    const updateParams: (string | number | null)[] = [];

    // Title update
    if (title !== undefined) {
      if (!title.trim()) {
        throw validationError('Title cannot be empty');
      }
      updates.push('title = ?');
      updateParams.push(title.trim());
    }

    // Description update
    if (description !== undefined) {
      updates.push('description = ?');
      updateParams.push(description.trim() || null);
    }

    // Priority update
    if (validatedPriority) {
      updates.push('priority = ?');
      updateParams.push(validatedPriority);
    }

    // Labels update
    if (labels !== undefined) {
      updates.push('labels = ?');
      updateParams.push(JSON.stringify(labels));
    }

    if (validatedStatus) {
      // Prevent moving blocked tasks to 'todo' or beyond
      if (validatedStatus === 'todo' || validatedStatus === 'in_progress') {
        const blockedCheck = await query<{ cnt: number }>(
          db,
          `SELECT COUNT(*) as cnt FROM task_dependencies td
           JOIN tasks t ON td.depends_on_task_id = t.id
           WHERE td.task_id = ? AND t.status != 'done'`,
          [id]
        );
        if ((blockedCheck[0]?.cnt ?? 0) > 0) {
          throw validationError('Cannot move task: it has unresolved dependencies');
        }
      }

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

    if (pr_url !== undefined) {
      updates.push('pr_url = ?');
      updateParams.push(pr_url || null);
    }

    if (branch_name !== undefined) {
      updates.push('branch_name = ?');
      updateParams.push(branch_name || null);
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

    // Auto-complete parent when all subtasks are done
    if (validatedStatus === 'done' && task.parent_task_id) {
      const siblingCounts = await query<{ total: number; done: number }>(
        db,
        `SELECT COUNT(*) as total,
          SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
         FROM tasks WHERE parent_task_id = ?`,
        [task.parent_task_id]
      );
      if (siblingCounts[0] && siblingCounts[0].total === siblingCounts[0].done) {
        await execute(
          db,
          `UPDATE tasks SET status = 'done', completed_at = COALESCE(completed_at, datetime("now")), updated_at = datetime("now")
           WHERE id = ? AND workspace_id = ?`,
          [task.parent_task_id, auth.workspaceId]
        );
      }
    }

    const parsedTask = {
      ...task,
      labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
      files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
    };

    return jsonWithRateLimit({ task: parsedTask }, rl.result);
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
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const { id } = await params;

    const db = getDb();
    await execute(
      db,
      'DELETE FROM tasks WHERE id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    return jsonWithRateLimit({ success: true }, rl.result);
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'delete_task',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
