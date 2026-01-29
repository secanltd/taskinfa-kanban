// API Route: /api/workers
// List all workers for a workspace

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query } from '@/lib/db/client';
import {
  createErrorResponse,
  authenticationError,
} from '@/lib/utils';

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
  // Joined from tasks table
  current_task_title?: string | null;
}

// GET /api/workers - List workers for workspace
export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const db = getDb();

    // Get workers with their current task info
    // Workers are considered online if heartbeat is within last 120 seconds
    const workers = await query<WorkerRow>(db, `
      SELECT
        w.*,
        t.title as current_task_title,
        CASE
          WHEN w.last_heartbeat IS NULL THEN 'offline'
          WHEN datetime(w.last_heartbeat) > datetime('now', '-120 seconds') THEN w.status
          ELSE 'offline'
        END as effective_status
      FROM workers w
      LEFT JOIN tasks t ON w.current_task_id = t.id
      WHERE w.workspace_id = ?
      ORDER BY w.name ASC
    `, [auth.workspaceId]);

    // Calculate time since last heartbeat for each worker
    const workersWithTimeSince = workers.map(w => {
      let lastSeenText = 'Never';
      if (w.last_heartbeat) {
        const heartbeatTime = new Date(w.last_heartbeat).getTime();
        const now = Date.now();
        const diffSeconds = Math.floor((now - heartbeatTime) / 1000);

        if (diffSeconds < 60) {
          lastSeenText = `${diffSeconds}s ago`;
        } else if (diffSeconds < 3600) {
          lastSeenText = `${Math.floor(diffSeconds / 60)}m ago`;
        } else if (diffSeconds < 86400) {
          lastSeenText = `${Math.floor(diffSeconds / 3600)}h ago`;
        } else {
          lastSeenText = `${Math.floor(diffSeconds / 86400)}d ago`;
        }
      }

      return {
        id: w.id,
        name: w.name,
        status: (w as any).effective_status || w.status,
        current_task: w.current_task_id ? {
          id: w.current_task_id,
          title: w.current_task_title,
        } : null,
        last_heartbeat: w.last_heartbeat,
        last_seen: lastSeenText,
        total_tasks_completed: w.total_tasks_completed,
      };
    });

    // Count by status
    const stats = {
      online: workersWithTimeSince.filter(w => w.status === 'idle' || w.status === 'working').length,
      working: workersWithTimeSince.filter(w => w.status === 'working').length,
      offline: workersWithTimeSince.filter(w => w.status === 'offline').length,
      error: workersWithTimeSince.filter(w => w.status === 'error').length,
    };

    return NextResponse.json({
      workers: workersWithTimeSince,
      stats,
    });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'list_workers',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
