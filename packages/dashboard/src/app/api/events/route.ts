// API Route: /api/events
// Accepts status events from Claude hooks, writes to session_events
// Triggers Telegram notification for critical events

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, queryOne, execute } from '@/lib/db/client';
import { rateLimitApi } from '@/lib/middleware/apiRateLimit';
import { nanoid } from 'nanoid';
import {
  createErrorResponse,
  authenticationError,
  validationError,
  validateString,
  validateEnum,
} from '@/lib/utils';
import type { SessionEvent, CreateEventRequest, NotificationConfig } from '@taskinfa/shared';

const VALID_EVENT_TYPES = [
  'task_claimed', 'task_progress', 'task_completed',
  'stuck', 'needs_input', 'error',
  'session_start', 'session_end', 'notification',
] as const;

const NOTIFY_EVENT_TYPES = new Set(['stuck', 'needs_input', 'error', 'task_completed']);

// POST /api/events — create a new event
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const body: CreateEventRequest = await request.json();

    const eventType = validateEnum(body.event_type, VALID_EVENT_TYPES, {
      fieldName: 'event_type',
      required: true,
    });
    if (!eventType) {
      throw validationError('event_type is required');
    }

    const sessionId = validateString(body.session_id, {
      fieldName: 'session_id',
      required: false,
    });

    const taskId = validateString(body.task_id, {
      fieldName: 'task_id',
      required: false,
    });

    const message = validateString(body.message, {
      fieldName: 'message',
      required: false,
      maxLength: 5000,
    });

    const metadata = body.metadata || {};

    const db = getDb();
    const eventId = `evt_${nanoid()}`;

    await execute(
      db,
      `INSERT INTO session_events (id, session_id, task_id, event_type, message, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [eventId, sessionId || null, taskId || null, eventType, message || null, JSON.stringify(metadata)]
    );

    // Update session's last_event_at if session_id provided
    if (sessionId) {
      await execute(
        db,
        `UPDATE sessions SET last_event_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
        [sessionId]
      );

      // Update session status based on event type
      if (eventType === 'stuck' || eventType === 'needs_input') {
        await execute(db, `UPDATE sessions SET status = 'stuck' WHERE id = ?`, [sessionId]);
      } else if (eventType === 'error') {
        await execute(db, `UPDATE sessions SET status = 'error' WHERE id = ?`, [sessionId]);
      } else if (eventType === 'session_end') {
        await execute(db, `UPDATE sessions SET status = 'completed' WHERE id = ?`, [sessionId]);
      }
    }

    // Trigger Telegram notification for critical events
    if (NOTIFY_EVENT_TYPES.has(eventType)) {
      try {
        await sendTelegramNotification(db, auth.workspaceId, eventType, message || '', taskId);
      } catch (notifyErr) {
        console.error('Telegram notification failed:', notifyErr);
      }
    }

    const event: SessionEvent = {
      id: eventId,
      session_id: sessionId || null,
      task_id: taskId || null,
      event_type: eventType,
      message: message || null,
      metadata,
      created_at: new Date().toISOString(),
    };

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, { operation: 'create_event' });
  }
}

// GET /api/events — list recent events
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const taskId = searchParams.get('task_id');
    const eventType = searchParams.get('event_type');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const db = getDb();
    let sql = `
      SELECT se.* FROM session_events se
      LEFT JOIN sessions s ON se.session_id = s.id
      WHERE (s.workspace_id = ? OR se.session_id IS NULL)
    `;
    const params: (string | number)[] = [auth.workspaceId];

    if (sessionId) {
      sql += ' AND se.session_id = ?';
      params.push(sessionId);
    }
    if (taskId) {
      sql += ' AND se.task_id = ?';
      params.push(taskId);
    }
    if (eventType) {
      sql += ' AND se.event_type = ?';
      params.push(eventType);
    }

    sql += ' ORDER BY se.created_at DESC LIMIT ?';
    params.push(limit);

    const events = await query<SessionEvent>(db, sql, params);

    const parsed = events.map(e => ({
      ...e,
      metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata as string) : e.metadata,
    }));

    return NextResponse.json({ events: parsed, total: parsed.length });
  } catch (error) {
    return createErrorResponse(error, { operation: 'list_events' });
  }
}

// Helper: send Telegram notification
async function sendTelegramNotification(
  db: ReturnType<typeof getDb>,
  workspaceId: string,
  eventType: string,
  message: string,
  taskId: string | null | undefined
) {
  const config = await queryOne<NotificationConfig>(
    db,
    'SELECT * FROM notification_config WHERE workspace_id = ?',
    [workspaceId]
  );

  if (!config || !config.telegram_enabled || !config.telegram_chat_id) return;

  // Check notification preferences
  if (eventType === 'task_completed' && !config.notify_on_complete) return;
  if ((eventType === 'stuck' || eventType === 'needs_input') && !config.notify_on_stuck) return;
  if (eventType === 'error' && !config.notify_on_error) return;

  const emoji: Record<string, string> = {
    task_completed: '\u2705',
    stuck: '\u26a0\ufe0f',
    needs_input: '\u2753',
    error: '\u274c',
  };

  let taskInfo = '';
  let prLink = '';
  if (taskId) {
    const task = await queryOne<{ title: string; pr_url: string | null }>(db, 'SELECT title, pr_url FROM tasks WHERE id = ?', [taskId]);
    if (task) {
      taskInfo = `\nTask: ${task.title}`;
      if (task.pr_url) prLink = `\n[View PR](${task.pr_url})`;
    }
  }

  const text = `${emoji[eventType] || '\u2139\ufe0f'} *${eventType.replace(/_/g, ' ').toUpperCase()}*${taskInfo}\n${message}${prLink}`;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.telegram_chat_id,
      text,
      parse_mode: 'Markdown',
    }),
  });
}
