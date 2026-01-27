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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600 mt-1">
              Manage your task lists and worker projects
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.name || user.email}
            </span>
            <Link
              href="/dashboard"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/settings"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Settings
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              What are Projects?
            </h2>
            <div className="text-gray-600 text-sm space-y-2">
              <p>
                <strong>Projects (Task Lists)</strong> are containers for related tasks.
                Each project represents a separate codebase or area of work.
              </p>
              <p>
                When you create a project, you can optionally provide a <strong>Git repository URL</strong>.
                Workers will automatically clone this repository when they start working on tasks from this project.
              </p>
              <p>
                The <strong>Project ID</strong> is used by worker containers to know which tasks to execute.
                You'll need this ID when setting up workers.
              </p>
            </div>
          </div>

          <ProjectsTable initialProjects={taskListsWithCounts} />
        </div>
      </main>

      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          Developed by <span className="font-semibold">SECAN</span> • Open Source MIT License
        </div>
      </footer>
    </div>
  );
}
