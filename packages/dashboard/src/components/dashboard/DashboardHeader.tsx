'use client';

import { useState } from 'react';
import type { TaskList } from '@taskinfa/shared';

interface Props {
  taskLists: TaskList[];
}

export default function DashboardHeader({ taskLists }: Props) {
  const [selectedProject, setSelectedProject] = useState<string>(taskLists[0]?.id || '');
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    task_list_id: taskLists[0]?.id || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create task');
      }

      // Reload page to show new task
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  if (taskLists.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Filter by Project:
          </label>
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2"
          >
            <option value="">All Projects</option>
            {taskLists.map((tl) => (
              <option key={tl.id} value={tl.id}>
                {tl.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setIsCreatingTask(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create Task
        </button>
      </div>

      {isCreatingTask && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-4 shadow">
          <h3 className="font-semibold text-lg mb-4">Create New Task</h3>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project *
              </label>
              <select
                value={formData.task_list_id}
                onChange={(e) => setFormData({ ...formData, task_list_id: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                required
              >
                <option value="">Select a project</option>
                {taskLists.map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {tl.name} ({tl.id})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Workers will execute tasks from the selected project
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Task Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="e.g., Fix login bug in auth/LoginForm.tsx"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                rows={4}
                placeholder="Provide detailed instructions for the worker..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Task'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingTask(false);
                  setError('');
                  setFormData({
                    title: '',
                    description: '',
                    priority: 'medium',
                    task_list_id: taskLists[0]?.id || '',
                  });
                }}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
