'use client';

import type { Task } from '@taskinfa/shared';
import type { WorkerStatus } from '@/hooks/useTaskStream';
import { formatWorkerName } from '@/utils/formatWorkerName';

interface TaskCardTask extends Task {
  is_blocked?: boolean;
}

interface TaskCardProps {
  task: TaskCardTask;
  worker?: WorkerStatus;
  isDragging?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
  onDragStart: () => void;
  onClick: () => void;
  onEdit?: () => void;
}

export default function TaskCard({
  task,
  worker,
  isDragging = false,
  selectionMode = false,
  isSelected = false,
  onToggleSelect,
  onDragStart,
  onClick,
  onEdit,
}: TaskCardProps) {
  const getPriorityStyles = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return {
          border: 'border-l-terminal-red',
          badge: 'bg-terminal-red/20 text-terminal-red',
        };
      case 'high':
        return {
          border: 'border-l-terminal-amber',
          badge: 'bg-terminal-amber/20 text-terminal-amber',
        };
      case 'medium':
        return {
          border: 'border-l-terminal-blue',
          badge: 'bg-terminal-blue/20 text-terminal-blue',
        };
      default:
        return {
          border: 'border-l-terminal-muted',
          badge: 'bg-terminal-muted/20 text-terminal-muted',
        };
    }
  };

  const priorityStyles = getPriorityStyles(task.priority);

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.();
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.(task.id);
  };

  const handleCardClick = () => {
    if (selectionMode) {
      onToggleSelect?.(task.id);
    } else {
      onClick();
    }
  };

  return (
    <div
      draggable={!selectionMode}
      onDragStart={selectionMode ? undefined : onDragStart}
      onClick={handleCardClick}
      className={`
        group relative bg-terminal-surface-hover rounded-lg p-4
        border border-terminal-border border-l-4 ${priorityStyles.border}
        hover:border-terminal-border-hover hover:shadow-lg hover:shadow-black/20
        transition-all duration-150 cursor-pointer
        ${isDragging ? 'opacity-50 scale-95' : ''}
        ${isSelected ? 'ring-2 ring-terminal-blue bg-terminal-blue/5' : ''}
      `}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <button
          onClick={handleCheckboxClick}
          className="absolute top-2 left-2 z-10 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
                     border-terminal-muted hover:border-terminal-blue"
          style={{
            backgroundColor: isSelected ? 'var(--terminal-blue)' : 'transparent',
            borderColor: isSelected ? 'var(--terminal-blue)' : undefined,
          }}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      )}

      {/* Edit button - appears on hover, hidden in selection mode */}
      {onEdit && !selectionMode && (
        <button
          onClick={handleEditClick}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-terminal-bg/50 text-terminal-muted
                     opacity-0 group-hover:opacity-100 hover:text-terminal-text hover:bg-terminal-bg
                     transition-all duration-150"
          title="Edit task"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      )}

      {/* Blocked indicator */}
      {task.is_blocked && (
        <div className="absolute top-2 left-2 p-1" title="Blocked by dependencies">
          <svg className="w-4 h-4 text-terminal-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      )}

      {/* Title */}
      <h3 className={`font-medium mb-2 ${task.is_blocked ? 'text-terminal-muted pl-6' : 'text-terminal-text'} ${selectionMode ? 'pl-6' : 'pr-8'}`}>{task.title}</h3>

      {/* Description */}
      {task.description && (
        <p className="text-sm text-terminal-muted mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Priority and Loop Count */}
      <div className="flex items-center gap-2 text-xs mb-2">
        <span className={`font-medium uppercase px-2 py-0.5 rounded ${priorityStyles.badge}`}>
          {task.priority}
        </span>
        {task.loop_count > 0 && (
          <span className="bg-terminal-purple/20 text-terminal-purple px-2 py-0.5 rounded">
            {task.loop_count} loops
          </span>
        )}
        {task.error_count > 0 && (
          <span className={`px-2 py-0.5 rounded ${
            task.error_count >= 5
              ? 'bg-terminal-red/20 text-terminal-red'
              : 'bg-terminal-amber/20 text-terminal-amber'
          }`}>
            {task.error_count} error{task.error_count !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Subtask Progress */}
      {(task.subtask_count ?? 0) > 0 && (
        <div className="flex items-center gap-2 text-xs mb-2">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-terminal-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className={`font-medium ${
              task.subtask_done_count === task.subtask_count
                ? 'text-terminal-green'
                : 'text-terminal-muted'
            }`}>
              {task.subtask_done_count}/{task.subtask_count} done
            </span>
          </div>
          <div className="flex-1 h-1.5 bg-terminal-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                task.subtask_done_count === task.subtask_count
                  ? 'bg-terminal-green'
                  : 'bg-terminal-blue'
              }`}
              style={{ width: `${((task.subtask_done_count ?? 0) / (task.subtask_count ?? 1)) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.labels.map((label, idx) => (
            <span
              key={idx}
              className="bg-terminal-bg text-terminal-muted px-2 py-0.5 rounded text-xs"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Worker Indicator */}
      {worker && (
        <div className="mt-3 pt-2 border-t border-terminal-border flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-terminal-blue animate-pulse" />
          <span className="text-xs text-terminal-blue font-medium">
            {formatWorkerName(worker.name)} is working on this
          </span>
        </div>
      )}

      {/* Assigned to (when no worker is actively working) */}
      {!worker && task.assigned_to && task.status === 'in_progress' && (
        <div className="mt-3 pt-2 border-t border-terminal-border flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-terminal-amber" />
          <span className="text-xs text-terminal-amber">
            Assigned to {formatWorkerName(task.assigned_to)}
          </span>
        </div>
      )}
    </div>
  );
}
