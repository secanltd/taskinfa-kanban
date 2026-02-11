import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, query } from '@/lib/db/client';
import { verifySessionToken } from '@/lib/auth/session';
import LogoutButton from '@/components/auth/LogoutButton';
import type { TaskList, User } from '@taskinfa/shared';

export const dynamic = 'force-dynamic';

interface ProjectOverview {
  id: string;
  name: string;
  slug: string | null;
  working_directory: string;
  is_active: boolean;
  task_counts: {
    backlog: number;
    todo: number;
    in_progress: number;
    review: number;
    done: number;
  };
  active_sessions: number;
  stuck_sessions: number;
  recent_event: string | null;
}

export default async function OverviewPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) {
    redirect('/auth/login');
  }

  const session = await verifySessionToken(sessionToken);
  if (!session) {
    redirect('/auth/login');
  }

  const db = getDb();

  const user = await query<User>(
    db,
    'SELECT id, email, name FROM users WHERE id = ?',
    [session.userId]
  );

  if (!user[0]) {
    redirect('/auth/login');
  }

  // Fetch all projects
  const taskLists = await query<TaskList>(
    db,
    'SELECT * FROM task_lists WHERE workspace_id = ? ORDER BY name ASC',
    [session.workspaceId]
  );

  // Fetch task counts per project per status
  const taskCounts = await query<{ task_list_id: string; status: string; count: number }>(
    db,
    `SELECT task_list_id, status, COUNT(*) as count
     FROM tasks WHERE workspace_id = ?
     GROUP BY task_list_id, status`,
    [session.workspaceId]
  );

  // Fetch active sessions per project
  const sessionCounts = await query<{ project_id: string; status: string; count: number }>(
    db,
    `SELECT project_id, status, COUNT(*) as count
     FROM sessions WHERE workspace_id = ? AND status IN ('active', 'stuck')
     GROUP BY project_id, status`,
    [session.workspaceId]
  );

  // Fetch most recent event per project
  const recentEvents = await query<{ project_id: string; message: string; created_at: string }>(
    db,
    `SELECT s.project_id, se.message, se.created_at
     FROM session_events se
     JOIN sessions s ON se.session_id = s.id
     WHERE s.workspace_id = ?
     ORDER BY se.created_at DESC
     LIMIT 50`,
    [session.workspaceId]
  );

  // Build project overview data
  const projects: ProjectOverview[] = taskLists.map(tl => {
    const counts = { backlog: 0, todo: 0, in_progress: 0, review: 0, done: 0 };
    for (const tc of taskCounts) {
      if (tc.task_list_id === tl.id && tc.status in counts) {
        counts[tc.status as keyof typeof counts] = tc.count;
      }
    }

    const activeSessions = sessionCounts
      .filter(sc => sc.project_id === tl.id && sc.status === 'active')
      .reduce((sum, sc) => sum + sc.count, 0);

    const stuckSessions = sessionCounts
      .filter(sc => sc.project_id === tl.id && sc.status === 'stuck')
      .reduce((sum, sc) => sum + sc.count, 0);

    const recentEvent = recentEvents.find(re => re.project_id === tl.id);

    return {
      id: tl.id,
      name: tl.name,
      slug: tl.slug,
      working_directory: tl.working_directory,
      is_active: tl.is_active,
      task_counts: counts,
      active_sessions: activeSessions,
      stuck_sessions: stuckSessions,
      recent_event: recentEvent?.message || null,
    };
  });

  const totalActive = projects.reduce((s, p) => s + p.active_sessions, 0);
  const totalStuck = projects.reduce((s, p) => s + p.stuck_sessions, 0);
  const totalTodo = projects.reduce((s, p) => s + p.task_counts.todo, 0);
  const totalInProgress = projects.reduce((s, p) => s + p.task_counts.in_progress, 0);

  return (
    <div className="min-h-screen bg-terminal-bg">
      {/* Header */}
      <header className="bg-terminal-surface border-b border-terminal-border">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">⚡</span>
                <h1 className="text-xl font-bold text-terminal-text">Overview</h1>
                <span className="text-sm text-terminal-muted">by Taskinfa</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-terminal-muted hidden md:block">
                {user[0].name || user[0].email}
              </span>
              <div className="h-4 w-px bg-terminal-border hidden md:block" />
              <a href="/dashboard" className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors">
                Board
              </a>
              <a href="/projects" className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors">
                Projects
              </a>
              <a href="/settings" className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors">
                Settings
              </a>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Global Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-2xl font-bold text-terminal-blue">{totalActive}</div>
            <div className="text-sm text-terminal-muted">Active Sessions</div>
          </div>
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-2xl font-bold text-terminal-amber">{totalStuck}</div>
            <div className="text-sm text-terminal-muted">Stuck</div>
          </div>
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-2xl font-bold text-terminal-green">{totalTodo}</div>
            <div className="text-sm text-terminal-muted">Tasks Pending</div>
          </div>
          <div className="bg-terminal-surface border border-terminal-border rounded-lg p-4">
            <div className="text-2xl font-bold text-terminal-purple">{totalInProgress}</div>
            <div className="text-sm text-terminal-muted">In Progress</div>
          </div>
        </div>

        {/* Projects Grid */}
        <h2 className="text-lg font-semibold text-terminal-text mb-4">Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const totalTasks = Object.values(project.task_counts).reduce((s, c) => s + c, 0);
            const isActive = project.active_sessions > 0;
            const isStuck = project.stuck_sessions > 0;

            return (
              <a
                key={project.id}
                href="/dashboard"
                className="bg-terminal-surface border border-terminal-border rounded-lg p-5 hover:border-terminal-border-hover hover:shadow-lg hover:shadow-black/20 transition-all"
              >
                {/* Project Header */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-terminal-text truncate">{project.name}</h3>
                  <div className="flex items-center gap-1.5">
                    {isActive && (
                      <span className="w-2.5 h-2.5 rounded-full bg-terminal-blue animate-pulse" title="Active session" />
                    )}
                    {isStuck && (
                      <span className="w-2.5 h-2.5 rounded-full bg-terminal-amber" title="Stuck session" />
                    )}
                    {!isActive && !isStuck && (
                      <span className="w-2.5 h-2.5 rounded-full bg-terminal-muted" title="Idle" />
                    )}
                  </div>
                </div>

                {/* Task Counts */}
                <div className="flex gap-2 mb-3 text-xs">
                  {project.task_counts.todo > 0 && (
                    <span className="bg-terminal-bg px-2 py-0.5 rounded text-terminal-muted">
                      {project.task_counts.todo} todo
                    </span>
                  )}
                  {project.task_counts.in_progress > 0 && (
                    <span className="bg-terminal-blue/10 px-2 py-0.5 rounded text-terminal-blue">
                      {project.task_counts.in_progress} active
                    </span>
                  )}
                  {project.task_counts.review > 0 && (
                    <span className="bg-terminal-amber/10 px-2 py-0.5 rounded text-terminal-amber">
                      {project.task_counts.review} review
                    </span>
                  )}
                  {project.task_counts.done > 0 && (
                    <span className="bg-terminal-green/10 px-2 py-0.5 rounded text-terminal-green">
                      {project.task_counts.done} done
                    </span>
                  )}
                  {totalTasks === 0 && (
                    <span className="text-terminal-muted">No tasks</span>
                  )}
                </div>

                {/* Session Info */}
                {project.active_sessions > 0 && (
                  <div className="text-xs text-terminal-blue mb-2">
                    {project.active_sessions} Claude session{project.active_sessions !== 1 ? 's' : ''} running
                  </div>
                )}

                {/* Recent Activity */}
                {project.recent_event && (
                  <div className="text-xs text-terminal-muted truncate border-t border-terminal-border pt-2 mt-2">
                    {project.recent_event}
                  </div>
                )}

                {/* Path */}
                <div className="text-xs text-terminal-muted/60 mt-2 font-mono truncate">
                  {project.working_directory}
                </div>
              </a>
            );
          })}

          {projects.length === 0 && (
            <div className="col-span-full bg-terminal-surface border border-terminal-border rounded-lg p-8 text-center">
              <p className="text-terminal-muted mb-4">No projects yet. Create your first project to get started.</p>
              <a href="/projects" className="btn-primary inline-block">
                Create Project
              </a>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
