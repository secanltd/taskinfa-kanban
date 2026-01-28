'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Task, TaskStatus, TaskPriority, TaskList } from '@taskinfa/shared';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (task: Task) => void;
  taskLists: TaskList[];
  defaultTaskListId?: string;
}

const priorityOptions: { value: TaskPriority; label: string; description: string }[] = [
  { value: 'low', label: 'Low', description: 'Can wait, no urgency' },
  { value: 'medium', label: 'Medium', description: 'Normal priority' },
  { value: 'high', label: 'High', description: 'Important, do soon' },
  { value: 'urgent', label: 'Urgent', description: 'Critical, do immediately' },
];

export default function CreateTaskModal({
  isOpen,
  onClose,
  onCreated,
  taskLists,
  defaultTaskListId,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [taskListId, setTaskListId] = useState(defaultTaskListId || taskLists[0]?.id || '');
  const [labelsInput, setLabelsInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  // Reset form when opened
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setTaskListId(defaultTaskListId || taskLists[0]?.id || '');
      setLabelsInput('');
      setError('');
    }
  }, [isOpen, defaultTaskListId, taskLists]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    if (!taskListId) {
      setError('Please select a project');
      return;
    }

    setIsCreating(true);
    try {
      const labels = labelsInput
        .split(',')
        .map(l => l.trim())
        .filter(Boolean);

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          task_list_id: taskListId,
          labels,
          status: 'todo' as TaskStatus,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { error?: string };
        throw new Error(errorData.error || 'Failed to create task');
      }

      const data = await response.json() as { task: Task };
      onCreated(data.task);
      onClose();
    } catch (err) {
      console.error('Error creating task:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-terminal-surface border border-terminal-border rounded-xl shadow-2xl max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-terminal-border">
          <h2 className="text-lg font-semibold text-terminal-text">Create New Task</h2>
          <button
            onClick={onClose}
            className="p-2 text-terminal-muted hover:text-terminal-text hover:bg-terminal-bg rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-terminal-red/10 border border-terminal-red/20 text-terminal-red rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-terminal-muted mb-2">
              Title <span className="text-terminal-red">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field w-full"
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-terminal-muted mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field w-full min-h-[80px] resize-y"
              placeholder="Add more details (optional)"
            />
          </div>

          {/* Project and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">
                Project <span className="text-terminal-red">*</span>
              </label>
              <select
                value={taskListId}
                onChange={(e) => setTaskListId(e.target.value)}
                className="input-field w-full"
              >
                {taskLists.length === 0 ? (
                  <option value="">No projects available</option>
                ) : (
                  taskLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="input-field w-full"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm font-medium text-terminal-muted mb-2">
              Labels
            </label>
            <input
              type="text"
              value={labelsInput}
              onChange={(e) => setLabelsInput(e.target.value)}
              className="input-field w-full"
              placeholder="bug, feature, frontend (comma separated)"
            />
          </div>

          {/* Priority Legend */}
          <div className="grid grid-cols-4 gap-2 pt-2">
            {priorityOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={`p-2 rounded-lg border text-center transition-all ${
                  priority === opt.value
                    ? opt.value === 'urgent'
                      ? 'bg-terminal-red/20 border-terminal-red text-terminal-red'
                      : opt.value === 'high'
                      ? 'bg-terminal-amber/20 border-terminal-amber text-terminal-amber'
                      : opt.value === 'medium'
                      ? 'bg-terminal-blue/20 border-terminal-blue text-terminal-blue'
                      : 'bg-terminal-muted/20 border-terminal-muted text-terminal-muted'
                    : 'bg-terminal-bg border-terminal-border text-terminal-muted hover:border-terminal-border-hover'
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
              </button>
            ))}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-terminal-border bg-terminal-bg">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn-primary"
            disabled={isCreating || !title.trim() || !taskListId}
          >
            {isCreating ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
