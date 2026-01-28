'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Task, TaskStatus, TaskPriority } from '@taskinfa/shared';
import { formatWorkerName } from '@/utils/formatWorkerName';

interface TaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedTask: Task) => void;
  onDelete: (taskId: string) => void;
  editMode?: boolean;
}

const statusColumns = [
  { status: 'backlog' as TaskStatus, label: 'Backlog' },
  { status: 'todo' as TaskStatus, label: 'To Do' },
  { status: 'in_progress' as TaskStatus, label: 'In Progress' },
  { status: 'review' as TaskStatus, label: 'Review' },
  { status: 'done' as TaskStatus, label: 'Done' },
];

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function TaskModal({
  task,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  editMode: initialEditMode = false,
}: TaskModalProps) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form state
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [labelsInput, setLabelsInput] = useState((task.labels || []).join(', '));

  // Reset form when task changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setStatus(task.status);
    setLabelsInput((task.labels || []).join(', '));
    setIsEditing(initialEditMode);
    setShowDeleteConfirm(false);
  }, [task, initialEditMode]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
      } else if (isEditing) {
        setIsEditing(false);
      } else {
        onClose();
      }
    }
  }, [onClose, isEditing, showDeleteConfirm]);

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

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const labels = labelsInput
        .split(',')
        .map(l => l.trim())
        .filter(Boolean);

      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          priority,
          status,
          labels,
        }),
      });

      if (!response.ok) throw new Error('Failed to update task');

      const data = await response.json() as { task: Task };
      onUpdate(data.task);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete task');

      onDelete(task.id);
      onClose();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelEdit = () => {
    setTitle(task.title);
    setDescription(task.description || '');
    setPriority(task.priority);
    setStatus(task.status);
    setLabelsInput((task.labels || []).join(', '));
    setIsEditing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getPriorityStyles = (p: string) => {
    switch (p) {
      case 'urgent':
        return 'bg-terminal-red/20 text-terminal-red';
      case 'high':
        return 'bg-terminal-amber/20 text-terminal-amber';
      case 'medium':
        return 'bg-terminal-blue/20 text-terminal-blue';
      default:
        return 'bg-terminal-muted/20 text-terminal-muted';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-terminal-surface border border-terminal-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-terminal-border">
          <h2 className="text-lg font-semibold text-terminal-text">
            {isEditing ? 'Edit Task' : 'Task Details'}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 text-terminal-muted hover:text-terminal-text hover:bg-terminal-bg rounded-lg transition-colors"
                  title="Edit"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2 text-terminal-muted hover:text-terminal-red hover:bg-terminal-red/10 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 text-terminal-muted hover:text-terminal-text hover:bg-terminal-bg rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-180px)] scrollbar-thin">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-terminal-muted mb-2">Title</label>
            {isEditing ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input-field w-full"
                placeholder="Task title"
              />
            ) : (
              <p className="text-lg font-medium text-terminal-text">{task.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-terminal-muted mb-2">Description</label>
            {isEditing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input-field w-full min-h-[100px] resize-y"
                placeholder="Task description (optional)"
              />
            ) : (
              <p className="text-terminal-text whitespace-pre-wrap">
                {task.description || <span className="text-terminal-muted italic">No description</span>}
              </p>
            )}
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">Status</label>
              {isEditing ? (
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="input-field w-full"
                >
                  {statusColumns.map((col) => (
                    <option key={col.status} value={col.status}>
                      {col.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-terminal-blue/20 text-terminal-blue">
                  {statusColumns.find((c) => c.status === task.status)?.label}
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">Priority</label>
              {isEditing ? (
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
              ) : (
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getPriorityStyles(task.priority)}`}>
                  {task.priority.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm font-medium text-terminal-muted mb-2">Labels</label>
            {isEditing ? (
              <input
                type="text"
                value={labelsInput}
                onChange={(e) => setLabelsInput(e.target.value)}
                className="input-field w-full"
                placeholder="Enter labels separated by commas"
              />
            ) : task.labels && task.labels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {task.labels.map((label, idx) => (
                  <span
                    key={idx}
                    className="bg-terminal-bg text-terminal-muted px-3 py-1 rounded-full text-sm"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-terminal-muted italic">No labels</span>
            )}
          </div>

          {/* Execution Info (read-only) */}
          {!isEditing && (task.loop_count > 0 || task.assigned_to) && (
            <div className="grid grid-cols-2 gap-4">
              {task.assigned_to && (
                <div>
                  <label className="block text-sm font-medium text-terminal-muted mb-2">Assigned To</label>
                  <p className="text-terminal-text">{formatWorkerName(task.assigned_to)}</p>
                </div>
              )}
              {task.loop_count > 0 && (
                <div>
                  <label className="block text-sm font-medium text-terminal-muted mb-2">Loop Count</label>
                  <p className="text-terminal-text">{task.loop_count}</p>
                </div>
              )}
            </div>
          )}

          {/* Files Changed (read-only) */}
          {!isEditing && task.files_changed && task.files_changed.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">Files Changed</label>
              <div className="bg-terminal-bg rounded-lg p-3 space-y-1 font-mono text-sm">
                {task.files_changed.map((file, idx) => (
                  <div key={idx} className="text-terminal-text flex items-center gap-2">
                    <svg className="w-4 h-4 text-terminal-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {file}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completion Notes (read-only) */}
          {!isEditing && task.completion_notes && (
            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">Completion Notes</label>
              <div className="bg-terminal-green/10 border border-terminal-green/20 rounded-lg p-4">
                <p className="text-terminal-text whitespace-pre-wrap">{task.completion_notes}</p>
              </div>
            </div>
          )}

          {/* Timestamps */}
          {!isEditing && (
            <div className="border-t border-terminal-border pt-4 space-y-2 text-sm">
              <div className="flex justify-between text-terminal-muted">
                <span>Created:</span>
                <span>{formatDate(task.created_at)}</span>
              </div>
              <div className="flex justify-between text-terminal-muted">
                <span>Updated:</span>
                <span>{formatDate(task.updated_at)}</span>
              </div>
              <div className="flex justify-between text-terminal-muted">
                <span>Task ID:</span>
                <span className="font-mono text-xs">{task.id}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-terminal-border bg-terminal-bg">
          {isEditing ? (
            <>
              <button onClick={cancelEdit} className="btn-secondary" disabled={isSaving}>
                Cancel
              </button>
              <button onClick={handleSave} className="btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="btn-secondary">
              Close
            </button>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-terminal-surface border border-terminal-border rounded-lg p-6 max-w-sm mx-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-terminal-red/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-terminal-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-terminal-text mb-2">Delete Task?</h3>
                <p className="text-terminal-muted mb-6">
                  Are you sure you want to delete &quot;{task.title}&quot;? This action cannot be undone.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn-secondary"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="btn-danger"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
