'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Task, TaskList, TaskStatus, SessionWithDetails, FeatureKey, FeatureToggle } from '@taskinfa/shared';
import { getStatusColumns } from '@taskinfa/shared';
import { useTaskStream } from '@/hooks/useTaskStream';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import SessionsPanel from './SessionsPanel';
import CreateTaskModal from './CreateTaskModal';

interface KanbanBoardProps {
  initialTasks: Task[];
  taskLists: TaskList[];
}

export default function KanbanBoard({ initialTasks, taskLists }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isSessionsPanelOpen, setIsSessionsPanelOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
  const { sessions, sessionStats, connected, onlineCount, workingCount, reconnect } = useTaskStream({
    onTasksUpdated: handleTasksUpdated,
    enabled: true,
  });

  // Helper to get session working on a task
  const getSessionForTask = (taskId: string): SessionWithDetails | undefined => {
    return sessions.find(s => s.current_task_id === taskId && s.status === 'active');
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((task) => task.status === status).sort((a, b) => a.order - b.order);
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

        {/* Right: Sessions + Create */}
        <div className="flex items-center gap-2 sm:gap-3">
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

      {/* Kanban Board - Full Width with Horizontal Scroll */}
      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 scrollbar-thin -mx-3 px-3 sm:mx-0 sm:px-0">
        {statusColumns.map((column) => {
          const columnTasks = getTasksByStatus(column.status);
          const isDragOver = dragOverColumn === column.status;

          return (
            <div key={column.status} className="flex-shrink-0 w-[260px] sm:w-72">
              {/* Column Header */}
              <div className="sticky top-0 z-10 bg-terminal-surface rounded-t-lg px-3 sm:px-4 py-2.5 sm:py-3 border border-terminal-border border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 sm:gap-2">
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
                  min-h-[calc(100vh-320px)] p-2 sm:p-3 space-y-2 sm:space-y-3 transition-all duration-150
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
                    {isDragOver ? 'Drop here' : 'No tasks'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
