import { getDb, query } from '@/lib/db/client';
import KanbanBoard from '@/components/KanbanBoard';
import type { Task } from '@taskinfa/shared';

export default async function HomePage() {
  const db = getDb();

  // Fetch all tasks for default workspace
  const tasks = await query<Task>(
    db,
    'SELECT * FROM tasks WHERE workspace_id = ? ORDER BY created_at DESC',
    ['default']
  );

  // Parse JSON fields
  const parsedTasks = tasks.map((task) => ({
    ...task,
    labels: JSON.parse(task.labels as any),
    files_changed: JSON.parse(task.files_changed as any),
  }));

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Taskinfa Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Autonomous task automation with Claude Code
          </p>
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
