'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface AnalyticsData {
  throughput: { date: string; count: number }[];
  cycleTime: { priority: string; avg_hours: number; task_count: number }[];
  statusDistribution: { status: string; count: number }[];
  burndown: { date: string; remaining: number }[];
  sessionAnalytics: {
    totalSessions: number;
    completedSessions: number;
    errorSessions: number;
    stuckSessions: number;
    avgDurationHours: number;
    successRate: number;
    retryRate: number;
  };
  bottlenecks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    hours_in_status: number;
    task_list_name: string | null;
  }[];
  period: string;
}

const STATUS_COLORS: Record<string, string> = {
  backlog: '#a1a1aa',
  todo: '#3b82f6',
  in_progress: '#a855f7',
  review: '#f59e0b',
  done: '#22c55e',
};

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#a1a1aa',
};

const tooltipStyle = {
  backgroundColor: '#171717',
  border: '1px solid #262626',
  borderRadius: '8px',
  color: '#fafafa',
  fontSize: '12px',
};

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics?period=${period}`);
        if (!res.ok) throw new Error('Failed to load analytics');
        const json = (await res.json()) as AnalyticsData;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-terminal-muted animate-pulse">Loading analytics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-terminal-red">{error || 'No data available'}</div>
      </div>
    );
  }

  const { sessionAnalytics, bottlenecks } = data;

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-terminal-muted">Period:</span>
        {(['day', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              period === p
                ? 'bg-terminal-green/20 text-terminal-green border border-terminal-green/30'
                : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface-hover border border-terminal-border'
            }`}
          >
            {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
          </button>
        ))}
      </div>

      {/* Session Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total Sessions"
          value={sessionAnalytics.totalSessions}
          color="text-terminal-blue"
        />
        <StatCard
          label="Success Rate"
          value={`${sessionAnalytics.successRate}%`}
          color="text-terminal-green"
        />
        <StatCard
          label="Avg Duration"
          value={`${sessionAnalytics.avgDurationHours}h`}
          color="text-terminal-purple"
        />
        <StatCard
          label="Avg Retries"
          value={sessionAnalytics.retryRate}
          color="text-terminal-amber"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Throughput Chart */}
        <ChartCard title="Task Throughput">
          {data.throughput.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.throughput}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No completed tasks yet" />
          )}
        </ChartCard>

        {/* Status Distribution */}
        <ChartCard title="Status Distribution">
          {data.statusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data.statusDistribution.map(d => ({
                    ...d,
                    name: STATUS_LABELS[d.status] || d.status,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="count"
                  nameKey="name"
                >
                  {data.statusDistribution.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#a1a1aa'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend
                  formatter={(value) => <span style={{ color: '#a1a1aa', fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No tasks yet" />
          )}
        </ChartCard>

        {/* Cycle Time by Priority */}
        <ChartCard title="Avg Cycle Time by Priority">
          {data.cycleTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={data.cycleTime} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis type="number" tick={{ fill: '#a1a1aa', fontSize: 11 }} unit="h" />
                <YAxis
                  type="category"
                  dataKey="priority"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  width={60}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: number | undefined) => [`${value ?? 0}h`, 'Avg Time']}
                />
                <Bar dataKey="avg_hours" name="Hours" radius={[0, 4, 4, 0]}>
                  {data.cycleTime.map((entry) => (
                    <Cell key={entry.priority} fill={PRIORITY_COLORS[entry.priority] || '#3b82f6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No completed tasks with timing data" />
          )}
        </ChartCard>

        {/* Burndown Chart */}
        <ChartCard title="Burndown (last 90 days)">
          {data.burndown.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.burndown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" />
                <XAxis dataKey="date" tick={{ fill: '#a1a1aa', fontSize: 11 }} />
                <YAxis tick={{ fill: '#a1a1aa', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="remaining"
                  name="Remaining"
                  stroke="#a855f7"
                  fill="#a855f7"
                  fillOpacity={0.15}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="No burndown data available" />
          )}
        </ChartCard>
      </div>

      {/* Session Analytics Detail */}
      <ChartCard title="Session Performance">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-terminal-green">{sessionAnalytics.completedSessions}</div>
            <div className="text-xs text-terminal-muted mt-1">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-terminal-red">{sessionAnalytics.errorSessions}</div>
            <div className="text-xs text-terminal-muted mt-1">Errored</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-terminal-amber">{sessionAnalytics.stuckSessions}</div>
            <div className="text-xs text-terminal-muted mt-1">Stuck</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-terminal-blue">
              {sessionAnalytics.totalSessions - sessionAnalytics.completedSessions - sessionAnalytics.errorSessions - sessionAnalytics.stuckSessions}
            </div>
            <div className="text-xs text-terminal-muted mt-1">Active/Idle</div>
          </div>
        </div>
      </ChartCard>

      {/* Bottleneck Detection */}
      <ChartCard title="Bottleneck Detection">
        {bottlenecks.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-terminal-muted mb-3">
              Tasks stuck in In Progress or Review for more than 24 hours
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-terminal-muted text-xs border-b border-terminal-border">
                    <th className="text-left py-2 pr-3">Task</th>
                    <th className="text-left py-2 pr-3">Status</th>
                    <th className="text-left py-2 pr-3">Priority</th>
                    <th className="text-left py-2 pr-3">Project</th>
                    <th className="text-right py-2">Hours Stuck</th>
                  </tr>
                </thead>
                <tbody>
                  {bottlenecks.map((b) => (
                    <tr key={b.id} className="border-b border-terminal-border/50">
                      <td className="py-2 pr-3 text-terminal-text max-w-[200px] truncate">{b.title}</td>
                      <td className="py-2 pr-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${STATUS_COLORS[b.status]}20`,
                            color: STATUS_COLORS[b.status],
                          }}
                        >
                          {STATUS_LABELS[b.status] || b.status}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: `${PRIORITY_COLORS[b.priority]}20`,
                            color: PRIORITY_COLORS[b.priority],
                          }}
                        >
                          {b.priority}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-terminal-muted text-xs">{b.task_list_name || '—'}</td>
                      <td className="py-2 text-right">
                        <span className={b.hours_in_status > 72 ? 'text-terminal-red font-bold' : 'text-terminal-amber'}>
                          {b.hours_in_status}h
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-terminal-muted text-sm">
            No bottlenecks detected — all tasks are flowing smoothly
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg p-3">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-terminal-muted mt-0.5">{label}</div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-terminal-text mb-4">{title}</h3>
      {children}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-[250px] text-terminal-muted text-sm">
      {message}
    </div>
  );
}
