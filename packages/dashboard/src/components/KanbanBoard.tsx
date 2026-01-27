'use client';

import { useState, useCallback } from 'react';
import type { Task, TaskList, TaskStatus } from '@taskinfa/shared';
import { useTaskStream, WorkerStatus } from '@/hooks/useTaskStream';
import WorkerStatusPanel from './WorkerStatusPanel';

interface KanbanBoardProps {
  initialTasks: Task[];
  taskLists: TaskList[];
}

const statusColumns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: 'bg-gray-100' },
  { status: 'todo', label: 'To Do', color: 'bg-blue-100' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-yellow-100' },
  { status: 'review', label: 'Review', color: 'bg-purple-100' },
  { status: 'done', label: 'Done', color: 'bg-green-100' },
];

export default function KanbanBoard({ initialTasks, taskLists }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Handle real-time task updates from SSE
  const handleTasksUpdated = useCallback((updatedTasks: Task[]) => {
    setTasks((prevTasks) => {
      // Merge updated tasks with existing tasks
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'border-red-500';
      case 'high':
        return 'border-orange-500';
      case 'medium':
        return 'border-blue-500';
      default:
        return 'border-gray-300';
    }
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

    try {
      // Update task status via API
      const response = await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      const data = await response.json() as { task: Task };
      const updatedTask = data.task;

      // Update local state
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === draggedTask.id ? updatedTask : t))
      );
    } catch (error) {
      console.error('Error updating task:', error);
      alert('Failed to move task. Please try again.');
    }

    setDraggedTask(null);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const closeModal = () => {
    setSelectedTask(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <>
      {/* Connection status indicator */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-600">
            {connected ? 'Live updates' : 'Disconnected'}
          </span>
          {!connected && (
            <button
              onClick={reconnect}
              className="text-sm text-blue-600 hover:text-blue-800 underline ml-2"
            >
              Reconnect
            </button>
          )}
        </div>
        <div className="text-sm text-gray-500">
          {onlineCount} worker{onlineCount !== 1 ? 's' : ''} online
          {workingCount > 0 && ` (${workingCount} working)`}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Main kanban board */}
        <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {statusColumns.map((column) => {
          const columnTasks = getTasksByStatus(column.status);
          const isDragOver = dragOverColumn === column.status;

          return (
            <div key={column.status} className="flex-shrink-0 w-80">
              <div className={`${column.color} rounded-t-lg p-3 border-b-2 border-gray-300`}>
                <h2 className="font-semibold text-gray-700">
                  {column.label}
                  <span className="ml-2 text-sm text-gray-500">({columnTasks.length})</span>
                </h2>
              </div>

              <div
                className={`bg-gray-50 rounded-b-lg p-3 min-h-[500px] space-y-3 transition-colors ${
                  isDragOver ? 'bg-blue-50 ring-2 ring-blue-400' : ''
                }`}
                onDragOver={(e) => handleDragOver(e, column.status)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.status)}
              >
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task)}
                    onClick={() => handleTaskClick(task)}
                    className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${getPriorityColor(
                      task.priority
                    )} hover:shadow-md transition-all cursor-move ${
                      draggedTask?.id === task.id ? 'opacity-50' : ''
                    }`}
                  >
                    <h3 className="font-medium text-gray-900 mb-2">{task.title}</h3>

                    {task.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-medium uppercase">{task.priority}</span>
                      {task.loop_count > 0 && (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {task.loop_count} loops
                        </span>
                      )}
                    </div>

                    {task.labels && task.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {task.labels.map((label, idx) => (
                          <span
                            key={idx}
                            className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    )}

                    {task.files_changed && task.files_changed.length > 0 && (
                      <div className="mt-2 text-xs text-gray-500">
                        📁 {task.files_changed.length} files changed
                      </div>
                    )}

                    {task.completion_notes && (
                      <div className="mt-2 text-xs text-gray-600 italic border-t pt-2">
                        {task.completion_notes}
                      </div>
                    )}

                    {/* Worker indicator for in-progress tasks */}
                    {(() => {
                      const worker = getWorkerForTask(task.id);
                      if (worker) {
                        return (
                          <div className="mt-2 pt-2 border-t flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-xs text-blue-700 font-medium">
                              {worker.name} is working on this
                            </span>
                          </div>
                        );
                      }
                      if (task.assigned_to && task.status === 'in_progress') {
                        return (
                          <div className="mt-2 pt-2 border-t flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-xs text-yellow-700">
                              Assigned to {task.assigned_to}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                ))}

                {columnTasks.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-8">
                    {isDragOver ? 'Drop here' : 'No tasks'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        </div>

        {/* Worker Status Sidebar */}
        <div className="w-72 flex-shrink-0">
          <WorkerStatusPanel
            workers={workers}
            connected={connected}
            onlineCount={onlineCount}
            workingCount={workingCount}
            onReconnect={reconnect}
          />
        </div>
      </div>

      {/* Task Details Modal */}
      {selectedTask && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Task Details</h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <p className="text-lg font-medium text-gray-900">{selectedTask.title}</p>
              </div>

              {/* Description */}
              {selectedTask.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedTask.description}</p>
                </div>
              )}

              {/* Status and Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {statusColumns.find((c) => c.status === selectedTask.status)?.label}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                      selectedTask.priority === 'urgent'
                        ? 'bg-red-100 text-red-800'
                        : selectedTask.priority === 'high'
                        ? 'bg-orange-100 text-orange-800'
                        : selectedTask.priority === 'medium'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {selectedTask.priority.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Labels */}
              {selectedTask.labels && selectedTask.labels.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Labels</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.labels.map((label, idx) => (
                      <span
                        key={idx}
                        className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Execution Info */}
              {(selectedTask.loop_count > 0 || selectedTask.assigned_to) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedTask.assigned_to && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assigned To
                      </label>
                      <p className="text-gray-900">{selectedTask.assigned_to}</p>
                    </div>
                  )}
                  {selectedTask.loop_count > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Loop Count
                      </label>
                      <p className="text-gray-900">{selectedTask.loop_count}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Files Changed */}
              {selectedTask.files_changed && selectedTask.files_changed.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Files Changed
                  </label>
                  <div className="bg-gray-50 rounded p-3 space-y-1">
                    {selectedTask.files_changed.map((file, idx) => (
                      <div key={idx} className="text-sm text-gray-700 font-mono">
                        📄 {file}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completion Notes */}
              {selectedTask.completion_notes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Completion Notes
                  </label>
                  <div className="bg-green-50 border border-green-200 rounded p-3">
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {selectedTask.completion_notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="border-t pt-4 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span className="font-medium">Created:</span>
                  <span>{formatDate(selectedTask.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Updated:</span>
                  <span>{formatDate(selectedTask.updated_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Task ID:</span>
                  <span className="font-mono text-xs">{selectedTask.id}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
