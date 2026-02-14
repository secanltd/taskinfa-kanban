// API Route: /api/analytics
// Aggregate analytics data for tasks, sessions, and productivity metrics

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query } from '@/lib/db/client';
import { createErrorResponse, authenticationError, validateEnum } from '@/lib/utils';

interface ThroughputRow {
  date: string;
  count: number;
}

interface CycleTimeRow {
  priority: string;
  avg_hours: number;
  task_count: number;
}

interface StatusDistributionRow {
  status: string;
  count: number;
}

interface BurndownRow {
  date: string;
  remaining: number;
}

interface SessionAnalyticsRow {
  total_sessions: number;
  completed_sessions: number;
  error_sessions: number;
  stuck_sessions: number;
  avg_duration_hours: number;
}

interface BottleneckRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  hours_in_status: number;
  task_list_name: string | null;
}

// GET /api/analytics
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const { searchParams } = new URL(request.url);
    const period = validateEnum(
      searchParams.get('period'),
      ['day', 'week', 'month'] as const,
      { fieldName: 'period', required: false }
    ) || 'week';

    const db = getDb();
    const workspaceId = auth.workspaceId;

    // Determine date format and range based on period
    let dateFormat: string;
    let daysBack: number;
    switch (period) {
      case 'day':
        dateFormat = '%Y-%m-%d';
        daysBack = 30;
        break;
      case 'week':
        dateFormat = '%Y-W%W';
        daysBack = 90;
        break;
      case 'month':
        dateFormat = '%Y-%m';
        daysBack = 365;
        break;
    }

    // 1. Throughput: tasks completed per period
    const throughput = await query<ThroughputRow>(
      db,
      `SELECT strftime(?, completed_at) as date, COUNT(*) as count
       FROM tasks
       WHERE workspace_id = ?
         AND status = 'done'
         AND completed_at IS NOT NULL
         AND completed_at >= datetime('now', ?)
       GROUP BY date
       ORDER BY date ASC`,
      [dateFormat, workspaceId, `-${daysBack} days`]
    );

    // 2. Cycle time: average hours from created to done, by priority
    const cycleTime = await query<CycleTimeRow>(
      db,
      `SELECT priority,
              ROUND(AVG(
                (julianday(completed_at) - julianday(created_at)) * 24
              ), 1) as avg_hours,
              COUNT(*) as task_count
       FROM tasks
       WHERE workspace_id = ?
         AND status = 'done'
         AND completed_at IS NOT NULL
         AND created_at IS NOT NULL
       GROUP BY priority
       ORDER BY CASE priority
         WHEN 'urgent' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
       END`,
      [workspaceId]
    );

    // 3. Status distribution
    const statusDistribution = await query<StatusDistributionRow>(
      db,
      `SELECT status, COUNT(*) as count
       FROM tasks
       WHERE workspace_id = ?
       GROUP BY status
       ORDER BY CASE status
         WHEN 'backlog' THEN 1
         WHEN 'todo' THEN 2
         WHEN 'in_progress' THEN 3
         WHEN 'review' THEN 4
         WHEN 'done' THEN 5
       END`,
      [workspaceId]
    );

    // 4. Burndown: tasks remaining (not done) over time
    // We approximate by counting completed tasks cumulatively
    const totalTasks = await query<{ total: number }>(
      db,
      `SELECT COUNT(*) as total FROM tasks WHERE workspace_id = ?`,
      [workspaceId]
    );

    const completedOverTime = await query<{ date: string; cumulative: number }>(
      db,
      `SELECT date, SUM(count) OVER (ORDER BY date) as cumulative
       FROM (
         SELECT strftime('%Y-%m-%d', completed_at) as date, COUNT(*) as count
         FROM tasks
         WHERE workspace_id = ?
           AND status = 'done'
           AND completed_at IS NOT NULL
           AND completed_at >= datetime('now', '-90 days')
         GROUP BY date
       )
       ORDER BY date ASC`,
      [workspaceId]
    );

    const total = totalTasks[0]?.total || 0;
    const burndown: BurndownRow[] = completedOverTime.map(row => ({
      date: row.date,
      remaining: total - row.cumulative,
    }));

    // 5. Session analytics
    const sessionStats = await query<SessionAnalyticsRow>(
      db,
      `SELECT
         COUNT(*) as total_sessions,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_sessions,
         SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_sessions,
         SUM(CASE WHEN status = 'stuck' THEN 1 ELSE 0 END) as stuck_sessions,
         ROUND(AVG(
           CASE WHEN last_event_at IS NOT NULL AND started_at IS NOT NULL
             THEN (julianday(last_event_at) - julianday(started_at)) * 24
             ELSE NULL
           END
         ), 1) as avg_duration_hours
       FROM sessions
       WHERE workspace_id = ?`,
      [workspaceId]
    );

    const sessionRetryData = await query<{ total_retries: number; tasks_with_retries: number }>(
      db,
      `SELECT
         SUM(error_count) as total_retries,
         SUM(CASE WHEN error_count > 0 THEN 1 ELSE 0 END) as tasks_with_retries
       FROM tasks
       WHERE workspace_id = ?
         AND assigned_to IS NOT NULL`,
      [workspaceId]
    );

    const stats = sessionStats[0];
    const retries = sessionRetryData[0];
    const sessionAnalytics = {
      totalSessions: stats?.total_sessions || 0,
      completedSessions: stats?.completed_sessions || 0,
      errorSessions: stats?.error_sessions || 0,
      stuckSessions: stats?.stuck_sessions || 0,
      avgDurationHours: stats?.avg_duration_hours || 0,
      successRate: stats?.total_sessions
        ? Math.round(((stats.completed_sessions || 0) / stats.total_sessions) * 100)
        : 0,
      retryRate: retries?.tasks_with_retries
        ? Math.round((retries.total_retries / retries.tasks_with_retries) * 100) / 100
        : 0,
    };

    // 6. Bottleneck detection: tasks stuck in review or in_progress for > 24 hours
    const bottlenecks = await query<BottleneckRow>(
      db,
      `SELECT t.id, t.title, t.status, t.priority,
              ROUND((julianday('now') - julianday(t.updated_at)) * 24, 1) as hours_in_status,
              tl.name as task_list_name
       FROM tasks t
       LEFT JOIN task_lists tl ON t.task_list_id = tl.id
       WHERE t.workspace_id = ?
         AND t.status IN ('in_progress', 'review')
         AND (julianday('now') - julianday(t.updated_at)) * 24 > 24
       ORDER BY hours_in_status DESC
       LIMIT 20`,
      [workspaceId]
    );

    return NextResponse.json({
      throughput,
      cycleTime,
      statusDistribution,
      burndown,
      sessionAnalytics,
      bottlenecks,
      period,
    });
  } catch (error) {
    return createErrorResponse(error, { operation: 'get_analytics' });
  }
}
