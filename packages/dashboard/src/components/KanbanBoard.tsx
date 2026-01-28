'use client';

import { useState, useCallback } from 'react';
import type { Task, TaskList, TaskStatus } from '@taskinfa/shared';
import { useTaskStream, WorkerStatus } from '@/hooks/useTaskStream';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import WorkersModal from './WorkersModal';
import CreateTaskModal from './CreateTaskModal';

interface KanbanBoardProps {
  initialTasks: Task[];
  taskLists: TaskList[];
}

const statusColumns: { status: TaskStatus; label: string; icon: string }[] = [
  { status: 'backlog', label: 'Backlog', icon: '📋' },
  { status: 'todo', label: 'To Do', icon: '📝' },
  { status: 'in_progress', label: 'In Progress', icon: '⚡' },
  { status: 'review', label: 'Review', icon: '👀' },
  { status: 'done', label: 'Done', icon: '✅' },
];

export default function KanbanBoard({ initialTasks, taskLists }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isWorkersModalOpen, setIsWorkersModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

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
  const { workers, connected, onlineCount, workingCount, reconnect } = useTaskStream({
    onTasksUpdated: handleTasksUpdated,
    enabled: true,
  });

  // Helper to get worker working on a task
  const getWorkerForTask = (taskId: string): WorkerStatus | undefined => {
    return workers.find(w => w.current_task?.id === taskId);
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
      <div className="flex items-center justify-between mb-6">
        {/* Left: Connection Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-terminal-green animate-pulse' : 'bg-terminal-red'
              }`}
            />
            <span className="text-sm text-terminal-muted">
              {connected ? 'Live updates' : 'Disconnected'}
            </span>
            {!connected && (
              <button
                onClick={reconnect}
                className="text-sm text-terminal-blue hover:text-terminal-text underline"
              >
                Reconnect
              </button>
            )}
          </div>
        </div>

        {/* Right: Workers + Create */}
        <div className="flex items-center gap-3">
          {/* Workers Indicator */}
          <button
            onClick={() => setIsWorkersModalOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-terminal-surface border border-terminal-border
                       hover:bg-terminal-surface-hover hover:border-terminal-border-hover transition-colors"
          >
            <span className={`w-2 h-2 rounded-full ${onlineCount > 0 ? 'bg-terminal-green' : 'bg-terminal-muted'}`} />
            <span className="text-sm text-terminal-text">
              {onlineCount} worker{onlineCount !== 1 ? 's' : ''} online
            </span>
            {workingCount > 0 && (
              <span className="text-sm text-terminal-muted">
                ({workingCount} working)
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
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* Kanban Board - Full Width with Horizontal Scroll */}
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
        {statusColumns.map((column) => {
          const columnTasks = getTasksByStatus(column.status);
          const isDragOver = dragOverColumn === column.status;

          return (
            <div key={column.status} className="flex-shrink-0 w-72">
              {/* Column Header */}
              <div className="sticky top-0 z-10 bg-terminal-surface rounded-t-lg px-4 py-3 border border-terminal-border border-b-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{column.icon}</span>
                    <h2 className="font-semibold text-terminal-text">{column.label}</h2>
                  </div>
                  <span className="text-sm text-terminal-muted bg-terminal-bg px-2 py-0.5 rounded">
                    {columnTasks.length}
                  </span>
                </div>
              </div>

              {/* Column Content */}
              <div
                className={`
                  bg-terminal-bg rounded-b-lg border border-terminal-border border-t-0
                  min-h-[calc(100vh-320px)] p-3 space-y-3 transition-all duration-150
                  ${isDragOver ? 'ring-2 ring-terminal-blue ring-inset bg-terminal-blue/5' : ''}
                `}
                onDragOver={(e) => handleDragOver(e, column.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    worker={getWorkerForTask(task.id)}
                    isDragging={draggedTask?.id === task.id}
                    onDragStart={() => handleDragStart(task)}
                    onClick={() => handleTaskClick(task)}
                    onEdit={() => handleTaskEdit(task)}
                  />
                ))}

                {columnTasks.length === 0 && (
                  <div className={`
                    text-center py-12 rounded-lg border-2 border-dashed transition-colors
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
        />
      )}

      {/* Workers Modal */}
      <WorkersModal
        isOpen={isWorkersModalOpen}
        onClose={() => setIsWorkersModalOpen(false)}
        workers={workers}
        connected={connected}
        onlineCount={onlineCount}
        workingCount={workingCount}
        onReconnect={reconnect}
      />

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
