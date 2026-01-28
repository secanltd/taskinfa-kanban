import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, query, queryOne } from '@/lib/db/client';
import { verifySessionToken } from '@/lib/auth/session';
import type { TaskList, User } from '@taskinfa/shared';
import ProjectsTable from '@/components/projects/ProjectsTable';
import LogoutButton from '@/components/auth/LogoutButton';
import Link from 'next/link';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
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

  // Get task count for each task list
  const taskListsWithCounts = await Promise.all(
    taskLists.map(async (taskList) => {
      const tasksCount = await query<{ count: number }>(
        db,
        'SELECT COUNT(*) as count FROM tasks WHERE task_list_id = ?',
        [taskList.id]
      );
      return {
        ...taskList,
        task_count: tasksCount[0]?.count || 0,
      };
    })
  );

  return (
    <div className="min-h-screen bg-terminal-bg">
      {/* Header */}
      <header className="bg-terminal-surface border-b border-terminal-border">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="flex items-center gap-2 text-terminal-muted hover:text-terminal-text transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm">Dashboard</span>
              </Link>
              <div className="h-4 w-px bg-terminal-border" />
              <div>
                <h1 className="text-xl font-bold text-terminal-text">Projects</h1>
                <p className="text-terminal-muted text-sm">
                  Manage your task lists and worker projects
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-terminal-muted hidden md:block">
                {user.name || user.email}
              </span>
              <div className="h-4 w-px bg-terminal-border hidden md:block" />
              <Link
                href="/settings"
                className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors"
              >
                Settings
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <div className="card p-6">
          {/* Info Section */}
          <div className="mb-6 p-4 bg-terminal-bg rounded-lg border border-terminal-border">
            <h2 className="text-lg font-semibold text-terminal-text mb-3">
              What are Projects?
            </h2>
            <div className="text-terminal-muted text-sm space-y-2">
              <p>
                <span className="text-terminal-text font-medium">Projects (Task Lists)</span> are containers for related tasks.
                Each project represents a separate codebase or area of work.
              </p>
              <p>
                When you create a project, you can optionally provide a <span className="text-terminal-text font-medium">Git repository URL</span>.
                Workers will automatically clone this repository when they start working on tasks from this project.
              </p>
              <p>
                The <span className="text-terminal-text font-medium">Project ID</span> is used by worker containers to know which tasks to execute.
                You&apos;ll need this ID when setting up workers.
              </p>
            </div>
          </div>

          <ProjectsTable initialProjects={taskListsWithCounts} />
        </div>
      </main>

      <footer className="bg-terminal-surface border-t border-terminal-border mt-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-4 text-center">
          <span className="text-terminal-muted text-sm">
            Developed by <span className="font-semibold text-terminal-text">SECAN</span> • Open Source MIT License
          </span>
        </div>
      </footer>
    </div>
  );
}
