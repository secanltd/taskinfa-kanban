'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Task, TaskList, TaskStatus, TaskPriority, TaskFilters, SavedFilter, SessionWithDetails, FeatureKey, FeatureToggle } from '@taskinfa/shared';
import { getStatusColumns } from '@taskinfa/shared';
import { useTaskStream } from '@/hooks/useTaskStream';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import SessionsPanel from './SessionsPanel';
import CreateTaskModal from './CreateTaskModal';
import BulkActionBar from './BulkActionBar';
import TaskFilterToolbar from './TaskFilterToolbar';

interface KanbanBoardProps {
  initialTasks: Task[];
  taskLists: TaskList[];
}


const FILTER_KEYS: (keyof TaskFilters)[] = [
  'q', 'status', 'priority', 'task_list_id', 'label',
  'assignee', 'created_after', 'created_before', 'sort', 'order',
];

function parseFiltersFromParams(params: URLSearchParams): TaskFilters {
  const filters: TaskFilters = {};
  for (const key of FILTER_KEYS) {
    const val = params.get(key);
    if (val) {
      (filters as Record<string, string>)[key] = val;
    }
  }
  return filters;
}

function filtersToParams(filters: TaskFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const val = filters[key];
    if (val) params.set(key, val);
  }
  return params;
}

export default function KanbanBoard({ initialTasks, taskLists }: KanbanBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filteredTasks, setFilteredTasks] = useState<Task[] | null>(null);
  const [isFiltering, setIsFiltering] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSessionsPanelOpen, setIsSessionsPanelOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Parse filters from URL on mount
  const [filters, setFilters] = useState<TaskFilters>(() => parseFiltersFromParams(searchParams));

  // Extract all unique labels from tasks
  const allLabels = useMemo(() => {
    const labelSet = new Set<string>();
    tasks.forEach((t) => {
      if (t.labels) t.labels.forEach((l) => labelSet.add(l));
    });
    return Array.from(labelSet).sort();
  }, [tasks]);

  // Check if any filters are active (that require API call)
  const hasActiveFilters = useMemo(() => {
    return Boolean(filters.q || filters.priority || filters.status || filters.task_list_id ||
      filters.label || filters.assignee || filters.created_after || filters.created_before ||
      (filters.sort && filters.sort !== 'order'));
  }, [filters]);

  // Fetch filtered tasks from API when filters change
  useEffect(() => {
    if (!hasActiveFilters) {
      setFilteredTasks(null);
      setIsFiltering(false);
      return;
    }

    setIsFiltering(true);
    const params = filtersToParams(filters);
    params.set('limit', '100');

    const controller = new AbortController();
    fetch(`/api/tasks?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json() as Promise<{ tasks: Task[] }>)
      .then((data) => {
        setFilteredTasks(data.tasks);
        setIsFiltering(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching filtered tasks:', err);
          setIsFiltering(false);
        }
      });

    return () => controller.abort();
  }, [filters, hasActiveFilters]);

  // Sync filters to URL
  useEffect(() => {
    const params = filtersToParams(filters);
    const newSearch = params.toString();
    const currentSearch = searchParams.toString();
    if (newSearch !== currentSearch) {
      router.replace(`/dashboard${newSearch ? `?${newSearch}` : ''}`, { scroll: false });
    }
  }, [filters]); // router/searchParams intentionally excluded - only sync on filter changes

  // Load saved filters
  useEffect(() => {
    fetch('/api/saved-filters')
      .then((res) => res.json() as Promise<{ filters: SavedFilter[] }>)
      .then((data) => setSavedFilters(data.filters || []))
      .catch(() => {});
  }, []);

  const handleFiltersChange = useCallback((newFilters: TaskFilters) => {
    setFilters(newFilters);
  }, []);

  const handleSaveFilter = useCallback(async (name: string) => {
    try {
      const res = await fetch('/api/saved-filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters }),
      });
      const data = await res.json() as { filter?: SavedFilter };
      if (data.filter) {
        setSavedFilters((prev) => [data.filter!, ...prev]);
      }
    } catch (err) {
      console.error('Error saving filter:', err);
    }
  }, [filters]);

  const handleDeleteSavedFilter = useCallback(async (id: string) => {
    try {
      await fetch(`/api/saved-filters/${id}`, { method: 'DELETE' });
      setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error('Error deleting filter:', err);
    }
  }, []);

  // Feature toggles for dynamic columns
  const [enabledFeatures, setEnabledFeatures] = useState<Record<FeatureKey, boolean>>({
    refinement: false,
    ai_review: false,
  });

  const statusColumns = getStatusColumns(enabledFeatures);

  useEffect(() => {
    async function fetchToggles() {
      try {
        const res = await fetch('/api/feature-toggles');
        if (!res.ok) return;
        const data = await res.json() as { toggles: FeatureToggle[] };
        const features: Record<FeatureKey, boolean> = { refinement: false, ai_review: false };
        for (const toggle of data.toggles) {
          if (toggle.feature_key in features) {
            features[toggle.feature_key as FeatureKey] = toggle.enabled;
          }
        }
        setEnabledFeatures(features);
      } catch {
        // Keep defaults if fetch fails
      }
    }
    fetchToggles();
  }, []);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Handle real-time task updates from SSE
  const handleTasksUpdated = useCallback((updatedTasks: Task[]) => {
    setTasks((prevTasks) => {
      const taskMap = new Map(prevTasks.map(t => [t.id, t]));
      updatedTasks.forEach(task => {
        taskMap.set(task.id, task);
      });
      return Array.from(taskMap.values());
    });
  }, []);

  // SSE hook for real-time updates
  const { sessions, sessionStats, connected, onlineCount, reconnect } = useTaskStream({
    onTasksUpdated: handleTasksUpdated,
    enabled: true,
  });

  // Helper to get session working on a task
  const getSessionForTask = (taskId: string): SessionWithDetails | undefined => {
    return sessions.find(s => s.current_task_id === taskId && s.status === 'active');
  };

  const displayTasks = filteredTasks ?? tasks;

  const getTasksByStatus = (status: TaskStatus) => {
    return displayTasks.filter((task) => task.status === status).sort((a, b) => a.order - b.order);
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(status);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    // Optimistic update
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === draggedTask.id ? { ...t, status: newStatus } : t))
    );

    try {
      const response = await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update task');

      const data = await response.json() as { task: Task };
      setTasks((prev) =>
        prev.map((t) => (t.id === draggedTask.id ? data.task : t))
      );
    } catch (error) {
      console.error('Error updating task:', error);
      setTasks(previousTasks);
    }

    setDraggedTask(null);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setEditingTask(null);
  };

  const handleTaskEdit = (task: Task) => {
    setSelectedTask(task);
    setEditingTask(task);
  };

  const handleTaskUpdate = (updatedTask: Task) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? updatedTask : t))
    );
    setSelectedTask(updatedTask);
  };

  const handleTaskDelete = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTask(null);
  };

  const handleTaskCreated = (newTask: Task) => {
    setTasks((prev) => [...prev, newTask]);
  };

  const closeModal = () => {
    setSelectedTask(null);
    setEditingTask(null);
  };

  // Selection mode handlers
  const toggleSelectionMode = () => {
    if (selectionMode) {
      setSelectionMode(false);
      setSelectedTaskIds(new Set());
    } else {
      setSelectionMode(true);
    }
  };

  const handleToggleSelect = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleSelectAllInColumn = (status: TaskStatus) => {
    const columnTaskIds = getTasksByStatus(status).map((t) => t.id);
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      const allSelected = columnTaskIds.every((id) => next.has(id));
      if (allSelected) {
        columnTaskIds.forEach((id) => next.delete(id));
      } else {
        columnTaskIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
  };

  const handleBulkMove = async (targetStatus: TaskStatus) => {
    const ids = Array.from(selectedTaskIds);
    const previousTasks = [...tasks];

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (selectedTaskIds.has(t.id) ? { ...t, status: targetStatus } : t))
    );

    try {
      const response = await fetch('/api/tasks/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: ids, update: { status: targetStatus } }),
      });

      if (!response.ok) throw new Error('Failed to bulk move tasks');

      const data = await response.json() as { tasks: Task[] };
      setTasks((prev) => {
        const updatedMap = new Map(data.tasks.map((t: Task) => [t.id, t]));
        return prev.map((t) => updatedMap.get(t.id) || t);
      });
    } catch (error) {
      console.error('Error bulk moving tasks:', error);
      setTasks(previousTasks);
    }

    setSelectedTaskIds(new Set());
    setSelectionMode(false);
  };

  const handleBulkEdit = async (update: { priority?: TaskPriority; labels?: string[]; assigned_to?: string | null }) => {
    const ids = Array.from(selectedTaskIds);
    const previousTasks = [...tasks];

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => {
        if (!selectedTaskIds.has(t.id)) return t;
        return {
          ...t,
          ...(update.priority && { priority: update.priority }),
          ...(update.labels !== undefined && { labels: update.labels }),
          ...(update.assigned_to !== undefined && { assigned_to: update.assigned_to }),
        };
      })
    );

    try {
      const response = await fetch('/api/tasks/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: ids, update }),
      });

      if (!response.ok) throw new Error('Failed to bulk edit tasks');

      const data = await response.json() as { tasks: Task[] };
      setTasks((prev) => {
        const updatedMap = new Map(data.tasks.map((t: Task) => [t.id, t]));
        return prev.map((t) => updatedMap.get(t.id) || t);
      });
    } catch (error) {
      console.error('Error bulk editing tasks:', error);
      setTasks(previousTasks);
    }

    setSelectedTaskIds(new Set());
    setSelectionMode(false);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedTaskIds);
    const previousTasks = [...tasks];

    // Optimistic update
    setTasks((prev) => prev.filter((t) => !selectedTaskIds.has(t.id)));

    try {
      const response = await fetch('/api/tasks/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_ids: ids }),
      });

      if (!response.ok) throw new Error('Failed to bulk delete tasks');
    } catch (error) {
      console.error('Error bulk deleting tasks:', error);
      setTasks(previousTasks);
    }

    setSelectedTaskIds(new Set());
    setSelectionMode(false);
  };

  return (
    <>
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6">
        {/* Left: Connection Status */}
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              connected ? 'bg-terminal-green animate-pulse' : 'bg-terminal-red'
            }`}
          />
          <span className="text-xs sm:text-sm text-terminal-muted">
            {connected ? 'Live' : 'Offline'}
          </span>
          {!connected && (
            <button
              onClick={reconnect}
              className="text-xs sm:text-sm text-terminal-blue hover:text-terminal-text underline touch-manipulation"
            >
              Reconnect
            </button>
          )}
        </div>

        {/* Right: Select Mode + Sessions + Create */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Selection Mode Toggle */}
          <button
            onClick={toggleSelectionMode}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border transition-colors touch-manipulation min-h-[44px] text-xs sm:text-sm
              ${selectionMode
                ? 'bg-terminal-blue/10 border-terminal-blue text-terminal-blue'
                : 'bg-terminal-surface border-terminal-border text-terminal-muted hover:bg-terminal-surface-hover hover:border-terminal-border-hover'
              }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <span className="hidden sm:inline">{selectionMode ? 'Cancel' : 'Select'}</span>
          </button>

          {/* Sessions Indicator */}
          <button
            onClick={() => setIsSessionsPanelOpen(!isSessionsPanelOpen)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-terminal-surface border border-terminal-border
                       hover:bg-terminal-surface-hover hover:border-terminal-border-hover transition-colors touch-manipulation min-h-[44px]"
          >
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sessionStats.active > 0 ? 'bg-terminal-blue animate-pulse' : onlineCount > 0 ? 'bg-terminal-green' : 'bg-terminal-muted'}`} />
            <span className="text-xs sm:text-sm text-terminal-text whitespace-nowrap">
              {sessionStats.active} <span className="hidden sm:inline">session{sessionStats.active !== 1 ? 's' : ''} active</span><span className="sm:hidden">active</span>
            </span>
            {sessionStats.stuck > 0 && (
              <span className="text-xs sm:text-sm text-terminal-amber">
                ({sessionStats.stuck})
              </span>
            )}
          </button>

          {/* Create Task Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* Sessions Panel (collapsible) */}
      {isSessionsPanelOpen && (
        <div className="mb-6">
          <SessionsPanel
            sessions={sessions}
            connected={connected}
            stats={sessionStats}
            onReconnect={reconnect}
          />
        </div>
      )}

      {/* Search/Filter Toolbar */}
      <TaskFilterToolbar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        taskLists={taskLists}
        allLabels={allLabels}
        savedFilters={savedFilters}
        onSaveFilter={handleSaveFilter}
        onDeleteSavedFilter={handleDeleteSavedFilter}
      />

      {/* Loading indicator for filtered results */}
      {isFiltering && (
        <div className="text-center py-2 text-sm text-terminal-muted">
          Searching...
        </div>
      )}

      {/* Kanban Board - Full Width with Horizontal Scroll */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-thin -mx-3 px-3 sm:mx-0 sm:px-0">
        {statusColumns.map((column) => {
          const columnTasks = getTasksByStatus(column.status);
          const isDragOver = dragOverColumn === column.status;
          const allColumnSelected = columnTasks.length > 0 && columnTasks.every((t) => selectedTaskIds.has(t.id));

          return (
            <div key={column.status} className="flex-shrink-0 w-[260px] sm:w-72">
              {/* Column Header */}
              <div className="sticky top-0 z-10 bg-terminal-surface rounded-t-lg px-3 sm:px-4 py-2.5 sm:py-3 border border-terminal-border border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    {selectionMode && columnTasks.length > 0 && (
                      <button
                        onClick={() => handleSelectAllInColumn(column.status)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0
                          ${allColumnSelected
                            ? 'border-terminal-blue'
                            : 'border-terminal-muted hover:border-terminal-blue'
                          }`}
                        style={{
                          backgroundColor: allColumnSelected ? 'var(--terminal-blue)' : 'transparent',
                          borderColor: allColumnSelected ? 'var(--terminal-blue)' : undefined,
                        }}
                        title={allColumnSelected ? 'Deselect all' : 'Select all'}
                      >
                        {allColumnSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    )}
                    <span className="text-sm sm:text-base">{column.icon}</span>
                    <h2 className="font-semibold text-terminal-text text-sm sm:text-base">{column.label}</h2>
                  </div>
                  <span className="text-xs sm:text-sm text-terminal-muted bg-terminal-bg px-1.5 sm:px-2 py-0.5 rounded">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              {/* Column Content */}
              <div
                className={`
                  bg-terminal-bg rounded-b-lg border border-terminal-border border-t-0
                  min-h-[calc(100vh-380px)] p-2 sm:p-3 space-y-2 sm:space-y-3 transition-all duration-150
                  ${isDragOver ? 'ring-2 ring-terminal-blue ring-inset bg-terminal-blue/5' : ''}
                `}
                onDragOver={(e) => handleDragOver(e, column.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                {columnTasks.map((task) => {
                  const session = getSessionForTask(task.id);
                  // Map session to worker-compatible shape for TaskCard
                  const worker = session ? {
                    id: session.id,
                    name: session.project_name || 'Claude',
                    status: 'working' as const,
                    current_task: { id: task.id, title: task.title },
                  } : undefined;

                  return (
                    <TaskCard
                      key={task.id}
                      task={task}
                      worker={worker}
                      isDragging={draggedTask?.id === task.id}
                      selectionMode={selectionMode}
                      isSelected={selectedTaskIds.has(task.id)}
                      onToggleSelect={handleToggleSelect}
                      onDragStart={() => handleDragStart(task)}
                      onClick={() => handleTaskClick(task)}
                      onEdit={() => handleTaskEdit(task)}
                    />
                  );
                })}

                {columnTasks.length === 0 && (
                  <div className={`
                    text-center py-8 sm:py-12 rounded-lg border-2 border-dashed transition-colors text-sm
                    ${isDragOver
                      ? 'border-terminal-blue text-terminal-blue'
                      : 'border-terminal-border text-terminal-muted'
                    }
                  `}>
                    {isDragOver ? 'Drop here' : hasActiveFilters ? 'No matches' : 'No tasks'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bulk Action Bar */}
      {selectionMode && selectedTaskIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedTaskIds.size}
          onMove={handleBulkMove}
          onEdit={handleBulkEdit}
          onDelete={handleBulkDelete}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Task Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          isOpen={true}
          onClose={closeModal}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
          editMode={editingTask !== null}
          statusColumns={statusColumns}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleTaskCreated}
        taskLists={taskLists}
      />
    </>
  );
}
