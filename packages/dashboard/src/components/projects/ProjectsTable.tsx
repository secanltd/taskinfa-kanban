'use client';

import { useState } from 'react';
import type { TaskList } from '@taskinfa/shared';

interface ProjectWithCount extends TaskList {
  task_count: number;
}

interface Props {
  initialProjects: ProjectWithCount[];
}

export default function ProjectsTable({ initialProjects }: Props) {
  const [projects, setProjects] = useState<ProjectWithCount[]>(initialProjects);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    repository_url: '',
    working_directory: '/workspace',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/task-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      setProjects([{ ...data.task_list, task_count: 0 }, ...projects]);
      setIsCreating(false);
      setFormData({
        name: '',
        description: '',
        repository_url: '',
        working_directory: '/workspace',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<TaskList>) => {
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/task-lists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update project');
      }

      setProjects(
        projects.map((p) =>
          p.id === id ? { ...p, ...data.task_list } : p
        )
      );
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project? You can only delete projects with no tasks.')) {
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/task-lists/${id}`, {
        method: 'DELETE',
      });

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to delete project');
      }

      setProjects(projects.filter((p) => p.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={isCreating || loading}
        >
          + Create Project
        </button>
      </div>

      {isCreating && (
        <div className="bg-gray-50 border border-gray-200 rounded p-4 mb-4">
          <h3 className="font-semibold mb-3">Create New Project</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="e.g., company-website"
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
                rows={2}
                placeholder="Brief description of this project"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Git Repository URL (Optional)
              </label>
              <input
                type="url"
                value={formData.repository_url}
                onChange={(e) => setFormData({ ...formData, repository_url: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="https://github.com/yourorg/repo"
              />
              <p className="text-xs text-gray-500 mt-1">
                Workers will clone this repository automatically
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Working Directory
              </label>
              <input
                type="text"
                value={formData.working_directory}
                onChange={(e) => setFormData({ ...formData, working_directory: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2"
                placeholder="/workspace"
              />
              <p className="text-xs text-gray-500 mt-1">
                Base directory where project will be cloned
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setFormData({
                    name: '',
                    description: '',
                    repository_url: '',
                    working_directory: '/workspace',
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

      {projects.length === 0 && !isCreating ? (
        <div className="text-center py-12 bg-gray-50 rounded border-2 border-dashed border-gray-300">
          <p className="text-gray-600 mb-4">No projects yet</p>
          <button
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create Your First Project
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Repository
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tasks
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {projects.map((project) => (
                <tr key={project.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {project.id}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {project.name}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-500 max-w-xs truncate">
                      {project.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {project.repository_url ? (
                      <a
                        href={project.repository_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 underline max-w-xs truncate block"
                      >
                        {project.repository_url}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">No repo</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-900">
                      {project.task_count}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-red-600 hover:text-red-700 disabled:opacity-50"
                      disabled={loading || project.task_count > 0}
                      title={project.task_count > 0 ? 'Cannot delete project with tasks' : 'Delete project'}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
