import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, query, queryOne } from '@/lib/db/client';
import { verifySessionToken } from '@/lib/auth/session';
import KanbanBoard from '@/components/KanbanBoard';
import LogoutButton from '@/components/auth/LogoutButton';
import type { Task, User } from '@taskinfa/shared';

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

  // Fetch tasks for user's workspace
  const tasks = await query<Task>(
    db,
    'SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC',
    [session.workspaceId]
  );

  // Parse JSON fields
  const parsedTasks = tasks.map((task) => ({
    ...task,
    labels: JSON.parse(task.labels as unknown as string),
    files_changed: JSON.parse(task.files_changed as unknown as string),
  }));

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Taskinfa Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Autonomous task automation with Claude Code
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.name || user.email}
            </span>
            <a
              href="/settings"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Settings
            </a>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <KanbanBoard initialTasks={parsedTasks} />
      </main>

      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          Developed by <span className="font-semibold">SECAN</span> • Open Source MIT License
        </div>
      </footer>
    </div>
  );
}
