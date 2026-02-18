'use client';

import { useState } from 'react';
import type { TaskList } from '@taskinfa/shared';
import ProjectEditModal from './ProjectEditModal';

interface ProjectWithCount extends TaskList {
  task_count: number;
}

interface Props {
  initialProjects: ProjectWithCount[];
}

export default function ProjectsTable({ initialProjects }: Props) {
  const [projects, setProjects] = useState<ProjectWithCount[]>(initialProjects);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    repository_url: '',
  });
  const [editingProject, setEditingProject] = useState<ProjectWithCount | null>(null);
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

      const data: { task_list?: ProjectWithCount; error?: string } = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      if (data.task_list) {
        setProjects([{ ...data.task_list, task_count: 0 }, ...projects]);
      }
      setIsCreating(false);
      setFormData({
        name: '',
        description: '',
        repository_url: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
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

      const data: { error?: string; message?: string } = await response.json();

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
        <div className="bg-terminal-red/10 border border-terminal-red/20 text-terminal-red px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="mb-4">
        <button
          onClick={() => setIsCreating(true)}
          className="btn-primary flex items-center gap-2"
          disabled={isCreating || loading}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Project
        </button>
      </div>

      {isCreating && (
        <div className="bg-terminal-bg border border-terminal-border rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-terminal-text mb-4">Create New Project</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">
                Project Name <span className="text-terminal-red">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field w-full"
                placeholder="e.g., company-website"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field w-full min-h-[80px] resize-y"
                placeholder="Brief description of this project"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">
                GitHub Repository URL <span className="text-terminal-red">*</span>
              </label>
              <input
                type="text"
                value={formData.repository_url}
                onChange={(e) => setFormData({ ...formData, repository_url: e.target.value })}
                className="input-field w-full"
                placeholder="https://github.com/yourorg/repo.git"
                required
              />
              <p className="text-xs text-terminal-muted mt-1">
                HTTPS URL of the GitHub repository. SSH URLs (git@github.com:...) are also accepted and will be converted automatically.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setFormData({
                    name: '',
                    description: '',
                    repository_url: '',
                  });
                }}
                className="btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 && !isCreating ? (
        <div className="text-center py-12 bg-terminal-bg rounded-lg border-2 border-dashed border-terminal-border">
          <div className="text-4xl mb-3">📁</div>
          <p className="text-terminal-muted mb-4">No projects yet</p>
          <button
            onClick={() => setIsCreating(true)}
            className="btn-primary"
          >
            Create Your First Project
          </button>
        </div>
      ) : projects.length > 0 && (
        <>
          {/* Mobile: Card layout */}
          <div className="space-y-3 md:hidden">
            {projects.map((project) => (
              <div key={project.id} className="bg-terminal-bg border border-terminal-border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-terminal-text">{project.name}</div>
                    {project.description && (
                      <div className="text-xs text-terminal-muted mt-1 line-clamp-2">{project.description}</div>
                    )}
                  </div>
                  <span className="text-sm text-terminal-text bg-terminal-surface px-2 py-0.5 rounded flex-shrink-0">
                    {project.task_count} task{project.task_count !== 1 ? 's' : ''}
                  </span>
                </div>
                {project.repository_url && (
                  <a
                    href={project.repository_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-terminal-blue hover:text-blue-400 truncate block transition-colors"
                  >
                    {project.repository_url}
                  </a>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-terminal-border">
                  <code className="text-xs bg-terminal-surface px-2 py-0.5 rounded text-terminal-muted font-mono truncate max-w-[200px]">
                    {project.id}
                  </code>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingProject(project)}
                      className="text-terminal-muted hover:text-terminal-text transition-colors touch-manipulation p-1"
                      title="Edit project"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="text-xs text-terminal-muted hover:text-terminal-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation px-2 py-1"
                      disabled={loading || project.task_count > 0}
                      title={project.task_count > 0 ? 'Cannot delete project with tasks' : 'Delete project'}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-terminal-border">
            <table className="min-w-full divide-y divide-terminal-border">
              <thead className="bg-terminal-bg">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider">
                    Project ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider">
                    Repository
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider">
                    Tasks
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider sticky right-0 bg-terminal-bg">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border">
                {projects.map((project) => (
                  <tr key={project.id} className="hover:bg-terminal-surface-hover transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <code className="text-sm bg-terminal-bg px-2 py-1 rounded text-terminal-text font-mono">
                        {project.id}
                      </code>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-terminal-text">
                        {project.name}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-terminal-muted max-w-xs truncate">
                        {project.description || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {project.repository_url ? (
                        <a
                          href={project.repository_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-terminal-blue hover:text-blue-400 max-w-xs truncate block transition-colors"
                        >
                          {project.repository_url}
                        </a>
                      ) : (
                        <span className="text-sm text-terminal-muted">No repo</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="text-sm text-terminal-text bg-terminal-bg px-2 py-1 rounded">
                        {project.task_count}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm sticky right-0 bg-terminal-bg">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setEditingProject(project)}
                          className="text-terminal-muted hover:text-terminal-text transition-colors"
                          title="Edit project"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="text-terminal-muted hover:text-terminal-red transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={loading || project.task_count > 0}
                          title={project.task_count > 0 ? 'Cannot delete project with tasks' : 'Delete project'}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {editingProject && (
        <ProjectEditModal
          project={editingProject}
          onClose={() => setEditingProject(null)}
          onUpdated={(updated) => {
            setProjects((prev) =>
              prev.map((p) =>
                p.id === updated.id ? { ...p, ...updated } : p
              )
            );
            setEditingProject(null);
          }}
        />
      )}
    </div>
  );
}
