// API Route: /api/workers/heartbeat
// Worker heartbeat endpoint for health tracking

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute, queryOne } from '@/lib/db/client';
import { nanoid } from 'nanoid';
import {
  createErrorResponse,
  authenticationError,
  validationError,
  validateString,
  validateEnum,
} from '@/lib/utils';

interface HeartbeatRequest {
  worker_name: string;
  status: 'idle' | 'working';
  current_task_id?: string | null;
}

interface WorkerRow {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  current_task_id: string | null;
  last_heartbeat: string | null;
  total_tasks_completed: number;
  created_at: string;
  updated_at: string;
}

// POST /api/workers/heartbeat - Worker sends heartbeat
export async function POST(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const body: HeartbeatRequest = await request.json();
    const { worker_name, status, current_task_id } = body;

    // Validate inputs
    const validatedName = validateString(worker_name, {
      fieldName: 'worker_name',
      required: true,
      minLength: 1,
      maxLength: 100,
    });

    if (!validatedName) {
      throw validationError('worker_name is required');
    }

    const validatedStatus = validateEnum(status,
      ['idle', 'working'] as const,
      { fieldName: 'status', required: true }
    );

    if (!validatedStatus) {
      throw validationError('status must be "idle" or "working"');
    }

    const db = getDb();

    // Check if worker already exists
    const existingWorker = await queryOne<WorkerRow>(db, `
      SELECT * FROM workers
      WHERE workspace_id = ? AND name = ?
    `, [auth.workspaceId, validatedName]);

    let workerId: string;

    if (existingWorker) {
      // Update existing worker
      workerId = existingWorker.id;

      // Check if task changed from working to idle (task completed)
      let taskIncrement = 0;
      if (existingWorker.status === 'working' && validatedStatus === 'idle' && existingWorker.current_task_id) {
        taskIncrement = 1;
      }

      await execute(db, `
        UPDATE workers
        SET
          status = ?,
          current_task_id = ?,
          last_heartbeat = datetime('now'),
          updated_at = datetime('now'),
          total_tasks_completed = total_tasks_completed + ?
        WHERE id = ?
      `, [
        validatedStatus,
        current_task_id || null,
        taskIncrement,
        workerId,
      ]);
    } else {
      // Create new worker
      workerId = `worker_${nanoid()}`;

      await execute(db, `
        INSERT INTO workers (id, workspace_id, name, status, current_task_id, last_heartbeat, total_tasks_completed)
        VALUES (?, ?, ?, ?, ?, datetime('now'), 0)
      `, [
        workerId,
        auth.workspaceId,
        validatedName,
        validatedStatus,
        current_task_id || null,
      ]);
    }

    // Fetch updated worker
    const worker = await queryOne<WorkerRow>(db, `
      SELECT * FROM workers WHERE id = ?
    `, [workerId]);

    return NextResponse.json({
      worker: {
        id: worker?.id,
        name: worker?.name,
        status: worker?.status,
        current_task_id: worker?.current_task_id,
        last_heartbeat: worker?.last_heartbeat,
        total_tasks_completed: worker?.total_tasks_completed,
      },
      next_heartbeat_in: 10, // Suggest next heartbeat in 10 seconds
    });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'worker_heartbeat',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
