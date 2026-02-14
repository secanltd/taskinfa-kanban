'use client';

import { useState } from 'react';
import type { TaskStatus, TaskPriority } from '@taskinfa/shared';

interface BulkActionBarProps {
  selectedCount: number;
  onMove: (status: TaskStatus) => void;
  onEdit: (update: { priority?: TaskPriority; labels?: string[]; assigned_to?: string | null }) => void;
  onDelete: () => void;
  onClearSelection: () => void;
}

type ActiveDropdown = 'move' | 'priority' | null;

const statusOptions: { status: TaskStatus; label: string; icon: string }[] = [
  { status: 'backlog', label: 'Backlog', icon: '📋' },
  { status: 'todo', label: 'To Do', icon: '📝' },
  { status: 'in_progress', label: 'In Progress', icon: '⚡' },
  { status: 'review', label: 'Review', icon: '👀' },
  { status: 'done', label: 'Done', icon: '✅' },
];

const priorityOptions: { priority: TaskPriority; label: string; color: string }[] = [
  { priority: 'urgent', label: 'Urgent', color: 'text-terminal-red' },
  { priority: 'high', label: 'High', color: 'text-terminal-amber' },
  { priority: 'medium', label: 'Medium', color: 'text-terminal-blue' },
  { priority: 'low', label: 'Low', color: 'text-terminal-muted' },
];

export default function BulkActionBar({
  selectedCount,
  onMove,
  onEdit,
  onDelete,
  onClearSelection,
}: BulkActionBarProps) {
  const [activeDropdown, setActiveDropdown] = useState<ActiveDropdown>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleDropdown = (dropdown: ActiveDropdown) => {
    setActiveDropdown((prev) => (prev === dropdown ? null : dropdown));
    setShowDeleteConfirm(false);
  };

  const handleMove = (status: TaskStatus) => {
    onMove(status);
    setActiveDropdown(null);
  };

  const handlePriority = (priority: TaskPriority) => {
    onEdit({ priority });
    setActiveDropdown(null);
  };

  const handleDeleteClick = () => {
    setActiveDropdown(null);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-terminal-surface border border-terminal-border rounded-xl shadow-2xl shadow-black/40 px-4 py-3 flex items-center gap-3">
        {/* Selected count */}
        <span className="text-sm text-terminal-text font-medium whitespace-nowrap">
          {selectedCount} selected
        </span>

        <div className="w-px h-6 bg-terminal-border" />

        {/* Move button with dropdown */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('move')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${activeDropdown === 'move'
                ? 'bg-terminal-blue/10 text-terminal-blue'
                : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface-hover'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Move
          </button>
          {activeDropdown === 'move' && (
            <div className="absolute bottom-full left-0 mb-2 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl shadow-black/30 py-1 min-w-[160px]">
              {statusOptions.map((opt) => (
                <button
                  key={opt.status}
                  onClick={() => handleMove(opt.status)}
                  className="w-full text-left px-3 py-2 text-sm text-terminal-text hover:bg-terminal-surface-hover flex items-center gap-2"
                >
                  <span>{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority button with dropdown */}
        <div className="relative">
          <button
            onClick={() => toggleDropdown('priority')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${activeDropdown === 'priority'
                ? 'bg-terminal-blue/10 text-terminal-blue'
                : 'text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface-hover'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Priority
          </button>
          {activeDropdown === 'priority' && (
            <div className="absolute bottom-full left-0 mb-2 bg-terminal-surface border border-terminal-border rounded-lg shadow-xl shadow-black/30 py-1 min-w-[140px]">
              {priorityOptions.map((opt) => (
                <button
                  key={opt.priority}
                  onClick={() => handlePriority(opt.priority)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-terminal-surface-hover flex items-center gap-2 ${opt.color}`}
                >
                  <span className="font-medium uppercase text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete button */}
        <div className="relative">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-terminal-red">Delete {selectedCount} task{selectedCount !== 1 ? 's' : ''}?</span>
              <button
                onClick={handleDeleteConfirm}
                className="px-2 py-1 rounded text-xs font-medium bg-terminal-red/20 text-terminal-red hover:bg-terminal-red/30 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 rounded text-xs text-terminal-muted hover:text-terminal-text transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-terminal-red hover:bg-terminal-red/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>

        <div className="w-px h-6 bg-terminal-border" />

        {/* Clear selection */}
        <button
          onClick={onClearSelection}
          className="p-1.5 rounded-lg text-terminal-muted hover:text-terminal-text hover:bg-terminal-surface-hover transition-colors"
          title="Clear selection"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
