import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, query, queryOne } from '@/lib/db/client';
import { verifySessionToken } from '@/lib/auth/session';
import KanbanBoard from '@/components/KanbanBoard';
import LogoutButton from '@/components/auth/LogoutButton';
import MobileNav from '@/components/MobileNav';
import type { Task, TaskList, User } from '@taskinfa/shared';

// Force dynamic rendering since we need access to D1 database and auth
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  // Check authentication
  if (!sessionToken) {
    redirect('/auth/login');
  }

  const session = await verifySessionToken(sessionToken);
  if (!session) {
    redirect('/auth/login');
  }

  const db = getDb();

  // Fetch user info
  const user = await queryOne<User>(
    db,
    'SELECT id, email, name FROM users WHERE id = ?',
    [session.userId]
  );

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch task lists for user's workspace
  const taskLists = await query<TaskList>(
    db,
    'SELECT * FROM task_lists WHERE workspace_id = ? ORDER BY created_at DESC',
    [session.workspaceId]
  );

  // Fetch tasks for user's workspace
  const tasks = await query<Task>(
    db,
    'SELECT * FROM tasks WHERE workspace_id = ? ORDER BY "order" ASC, created_at ASC',
    [session.workspaceId]
  );

  // Parse JSON fields
  const parsedTasks = tasks.map((task) => ({
    ...task,
    labels: JSON.parse(task.labels as unknown as string),
    files_changed: JSON.parse(task.files_changed as unknown as string),
  }));

  return (
    <div className="min-h-screen bg-terminal-bg">
      {/* Header */}
      <header className="bg-terminal-surface border-b border-terminal-border relative">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo and Title */}
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xl sm:text-2xl">⚡</span>
                <h1 className="text-lg sm:text-xl font-bold text-terminal-text">Kanban</h1>
                <span className="text-xs sm:text-sm text-terminal-muted hidden sm:inline">by Taskinfa</span>
              </div>
              <span className="text-terminal-muted text-sm hidden lg:block">
                Autonomous task automation with Claude Code
              </span>
            </div>

            {/* Right: Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-terminal-muted">
                {user.name || user.email}
              </span>
              <div className="h-4 w-px bg-terminal-border" />
              <a
                href="/overview"
                className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors"
              >
                Overview
              </a>
              <a
                href="/analytics"
                className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors"
              >
                Analytics
              </a>
              <a
                href="/projects"
                className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors"
              >
                Projects
              </a>
              <a
                href="/settings"
                className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors"
              >
                Settings
              </a>
              <LogoutButton />
            </div>

            {/* Mobile Navigation */}
            <MobileNav
              links={[
                { href: '/dashboard', label: 'Board', active: true },
                { href: '/overview', label: 'Overview' },
                { href: '/analytics', label: 'Analytics' },
                { href: '/projects', label: 'Projects' },
                { href: '/settings', label: 'Settings' },
              ]}
              userName={user.name || user.email}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {taskLists.length === 0 ? (
          <div className="bg-terminal-amber/10 border border-terminal-amber/20 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-terminal-amber/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <h3 className="font-semibold text-terminal-text mb-2">
                  No Projects Found
                </h3>
                <p className="text-terminal-muted mb-4">
                  You need to create at least one project before you can create tasks.
                  Projects organize your tasks and are used by worker containers to know which tasks to execute.
                </p>
                <a
                  href="/projects"
                  className="btn-primary inline-block"
                >
                  Create Your First Project
                </a>
              </div>
            </div>
          </div>
        ) : (
          <Suspense fallback={<div className="text-terminal-muted text-center py-8">Loading board...</div>}>
            <KanbanBoard initialTasks={parsedTasks} taskLists={taskLists} />
          </Suspense>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-terminal-surface border-t border-terminal-border mt-auto">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-4 text-center">
          <span className="text-terminal-muted text-xs sm:text-sm">
            Developed by <span className="font-semibold text-terminal-text">SECAN</span> • Open Source MIT License
          </span>
        </div>
      </footer>
    </div>
  );
}
