'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Task, TaskStatus, TaskPriority, StatusColumn, TaskDependency } from '@taskinfa/shared';
import { getStatusColumns } from '@taskinfa/shared';
import { formatWorkerName } from '@/utils/formatWorkerName';
import Modal, { ModalHeader, ModalFooter } from './Modal';

interface TaskDetails extends Task {
  subtasks?: Task[];
  dependencies?: TaskDependency[];
  blocked_by?: { id: string; title: string; status: string }[];
  is_blocked?: boolean;
}

const DEFAULT_STATUS_COLUMNS = getStatusColumns({ refinement: false, ai_review: false });

interface TaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedTask: Task) => void;
  onDelete: (taskId: string) => void;
  editMode?: boolean;
  statusColumns?: StatusColumn[];
}

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
  statusColumns = DEFAULT_STATUS_COLUMNS,
}: TaskModalProps) {
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResettingErrors, setIsResettingErrors] = useState(false);
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);

  // Fetch full task details (subtasks, dependencies) when modal opens
  useEffect(() => {
    if (!isOpen) return;
    async function fetchDetails() {
      try {
        const res = await fetch(`/api/tasks/${task.id}`);
        if (!res.ok) return;
        const data = await res.json() as { task: TaskDetails };
        setTaskDetails(data.task);
      } catch {
        // Non-critical, continue without details
      }
    }
    fetchDetails();
  }, [isOpen, task.id]);

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

  const handleEscapeKey = useCallback(() => {
    if (showDeleteConfirm) {
      setShowDeleteConfirm(false);
    } else if (isEditing) {
      setIsEditing(false);
    } else {
      onClose();
    }
  }, [onClose, isEditing, showDeleteConfirm]);

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

  const handleResetErrorCount = async () => {
    setIsResettingErrors(true);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error_count: 0 }),
      });

      if (!response.ok) throw new Error('Failed to reset error count');

      const data = await response.json() as { task: Task };
      onUpdate(data.task);
    } catch (error) {
      console.error('Error resetting error count:', error);
      alert('Failed to reset error count. Please try again.');
    } finally {
      setIsResettingErrors(false);
    }
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

  const headerActions = !isEditing ? (
    <>
      <button
        onClick={() => setIsEditing(true)}
        className="p-2 text-terminal-muted hover:text-terminal-text hover:bg-terminal-bg rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="Edit"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button
        onClick={() => setShowDeleteConfirm(true)}
        className="p-2 text-terminal-muted hover:text-terminal-red hover:bg-terminal-red/10 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="Delete"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </>
  ) : undefined;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" onEscapeKey={handleEscapeKey}>
      <ModalHeader onClose={onClose} actions={headerActions}>
        {isEditing ? 'Edit Task' : 'Task Details'}
      </ModalHeader>

      {/* Content */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 scrollbar-thin">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
        {!isEditing && (task.loop_count > 0 || task.error_count > 0 || task.assigned_to) && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
            {task.error_count > 0 && (
              <div className="bg-terminal-red/10 border border-terminal-red/20 rounded-lg p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-terminal-red/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-terminal-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-terminal-red">
                        {task.error_count} error{task.error_count !== 1 ? 's' : ''}
                        {task.error_count >= 5 && (
                          <span className="ml-1 sm:ml-2 text-xs font-normal text-terminal-red/80">
                            — skipped by orchestrator
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-terminal-muted mt-0.5">
                        Orchestrator skips tasks after too many errors
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleResetErrorCount}
                    disabled={isResettingErrors}
                    className="px-3 py-1.5 text-xs font-medium rounded-md
                               bg-terminal-surface text-terminal-text border border-terminal-border
                               hover:bg-terminal-surface-hover hover:border-terminal-border-hover
                               disabled:opacity-50 transition-colors flex-shrink-0 touch-manipulation self-start sm:self-center"
                  >
                    {isResettingErrors ? 'Resetting...' : 'Reset'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pull Request (read-only) */}
        {!isEditing && task.pr_url && (
          <div>
            <label className="block text-sm font-medium text-terminal-muted mb-2">Pull Request</label>
            <a
              href={task.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
                         bg-terminal-purple/10 text-terminal-purple border border-terminal-purple/20
                         hover:bg-terminal-purple/20 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                <path d="M7.177 3.073L9.573.677A.25.25 0 0110 .854v4.792a.25.25 0 01-.427.177L7.177 3.427a.25.25 0 010-.354zM3.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122v5.256a2.251 2.251 0 11-1.5 0V5.372A2.25 2.25 0 011.5 3.25zM11 2.5h-1V4h1a1 1 0 011 1v5.628a2.251 2.251 0 101.5 0V5A2.5 2.5 0 0011 2.5zm1 10.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0zM3.75 12a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
              </svg>
              View PR #{task.pr_url.split('/').pop()}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            {task.branch_name && (
              <p className="mt-2 text-xs text-terminal-muted font-mono">Branch: {task.branch_name}</p>
            )}
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

        {/* Subtasks (read-only) */}
        {!isEditing && taskDetails?.subtasks && taskDetails.subtasks.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-terminal-muted mb-2">
              Subtasks ({taskDetails.subtasks.filter(s => s.status === 'done').length}/{taskDetails.subtasks.length} done)
            </label>
            <div className="space-y-1.5">
              {taskDetails.subtasks.map((subtask) => (
                <div key={subtask.id} className="flex items-center gap-2 text-sm">
                  <span className={`w-4 h-4 flex-shrink-0 rounded border ${
                    subtask.status === 'done'
                      ? 'bg-terminal-green/20 border-terminal-green text-terminal-green'
                      : 'border-terminal-border'
                  } flex items-center justify-center`}>
                    {subtask.status === 'done' && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={subtask.status === 'done' ? 'text-terminal-muted line-through' : 'text-terminal-text'}>
                    {subtask.title}
                  </span>
                  <span className="text-xs text-terminal-muted ml-auto">
                    {statusColumns.find(c => c.status === subtask.status)?.label || subtask.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies (read-only) */}
        {!isEditing && taskDetails?.blocked_by && taskDetails.blocked_by.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-terminal-muted mb-2">Dependencies</label>
            <div className="bg-terminal-amber/10 border border-terminal-amber/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-terminal-amber" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-sm font-medium text-terminal-amber">
                  {taskDetails.is_blocked ? 'Blocked by:' : 'Depends on (resolved):'}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                {taskDetails.blocked_by.map((dep) => (
                  <div key={dep.id} className="flex items-center gap-2 text-terminal-muted">
                    <span className={dep.status === 'done' ? 'text-terminal-green' : ''}>
                      {dep.status === 'done' ? '✓' : '○'}
                    </span>
                    <span className={dep.status === 'done' ? 'line-through' : ''}>
                      {dep.title}
                    </span>
                    <span className="text-xs ml-auto">
                      {statusColumns.find(c => c.status === dep.status)?.label || dep.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Timestamps */}
        {!isEditing && (
          <div className="border-t border-terminal-border pt-4 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between text-terminal-muted gap-2">
              <span className="flex-shrink-0">Created:</span>
              <span className="truncate text-right">{formatDate(task.created_at)}</span>
            </div>
            <div className="flex justify-between text-terminal-muted gap-2">
              <span className="flex-shrink-0">Updated:</span>
              <span className="truncate text-right">{formatDate(task.updated_at)}</span>
            </div>
            <div className="flex justify-between text-terminal-muted gap-2">
              <span className="flex-shrink-0">Task ID:</span>
              <span className="font-mono text-xs truncate text-right">{task.id}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <ModalFooter>
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
      </ModalFooter>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-terminal-surface border border-terminal-border rounded-t-lg sm:rounded-lg p-6 w-full sm:max-w-sm sm:mx-4">
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
    </Modal>
  );
}
