'use client';

import type { Task } from '@taskinfa/shared';
import type { WorkerStatus } from '@/hooks/useTaskStream';
import { formatWorkerName } from '@/utils/formatWorkerName';

interface TaskCardProps {
  task: Task;
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

      {/* Title */}
      <h3 className={`font-medium text-terminal-text mb-2 ${selectionMode ? 'pl-6' : 'pr-8'}`}>{task.title}</h3>

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
