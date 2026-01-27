// API Route: /api/tasks/stream
// Server-Sent Events (SSE) endpoint for real-time task and worker updates

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query } from '@/lib/db/client';
import type { Task } from '@taskinfa/shared';
import { safeJsonParseArray } from '@/lib/utils';

interface WorkerStatus {
  id: string;
  name: string;
  status: string;
  current_task_id: string | null;
  current_task_title: string | null;
  last_heartbeat: string | null;
}

// GET /api/tasks/stream - SSE stream for real-time updates
export async function GET(request: NextRequest) {
  // Authenticate
  const auth = await authenticateRequestUnified(request);
  if (!auth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const workspaceId = auth.workspaceId;

  // Create a readable stream for SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Use SQLite-compatible datetime format (YYYY-MM-DD HH:MM:SS)
      const toSqliteDateTime = (date: Date) =>
        date.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];

      let lastTaskUpdate = toSqliteDateTime(new Date());
      let isRunning = true;

      // Helper to send SSE events
      const sendEvent = (event: string, data: any) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream might be closed
          isRunning = false;
        }
      };

      // Send initial connection event
      sendEvent('connected', {
        timestamp: lastTaskUpdate,
        message: 'Connected to real-time updates',
      });

      // Poll for updates every 2 seconds
      const pollInterval = setInterval(async () => {
        if (!isRunning) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const db = getDb();

          // Get tasks updated since last check
          const updatedTasks = await query<Task>(db, `
            SELECT * FROM tasks
            WHERE workspace_id = ? AND updated_at > ?
            ORDER BY updated_at DESC
            LIMIT 50
          `, [workspaceId, lastTaskUpdate]);

          // Get current worker statuses (online = heartbeat in last 30s)
          const workers = await query<WorkerStatus>(db, `
            SELECT
              w.id,
              w.name,
              CASE
                WHEN w.last_heartbeat IS NULL THEN 'offline'
                WHEN datetime(w.last_heartbeat) > datetime('now', '-30 seconds') THEN w.status
                ELSE 'offline'
              END as status,
              w.current_task_id,
              t.title as current_task_title,
              w.last_heartbeat
            FROM workers w
            LEFT JOIN tasks t ON w.current_task_id = t.id
            WHERE w.workspace_id = ?
            ORDER BY w.name ASC
          `, [workspaceId]);

          // Send task updates if any
          if (updatedTasks.length > 0) {
            const parsedTasks = updatedTasks.map(task => ({
              ...task,
              labels: safeJsonParseArray<string>(task.labels as unknown as string, []),
              files_changed: safeJsonParseArray<string>(task.files_changed as unknown as string, []),
            }));

            sendEvent('tasks:updated', {
              tasks: parsedTasks,
              count: parsedTasks.length,
            });

            // Update last check time to most recent task update
            lastTaskUpdate = updatedTasks[0].updated_at;
          }

          // Always send worker status (it's small and useful)
          sendEvent('workers:status', {
            workers: workers.map(w => ({
              id: w.id,
              name: w.name,
              status: w.status,
              current_task: w.current_task_id ? {
                id: w.current_task_id,
                title: w.current_task_title,
              } : null,
            })),
            online_count: workers.filter(w => w.status === 'idle' || w.status === 'working').length,
            working_count: workers.filter(w => w.status === 'working').length,
          });

          // Send heartbeat to keep connection alive
          sendEvent('heartbeat', {
            timestamp: new Date().toISOString(),
          });

        } catch (error) {
          console.error('SSE poll error:', error);
          sendEvent('error', {
            message: 'Error fetching updates',
            timestamp: new Date().toISOString(),
          });
        }
      }, 2000);

      // Handle abort/disconnect
      request.signal.addEventListener('abort', () => {
        isRunning = false;
        clearInterval(pollInterval);
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
