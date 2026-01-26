'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@taskinfa/shared';

interface KanbanBoardProps {
  initialTasks: Task[];
}

const statusColumns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: 'bg-gray-100' },
  { status: 'todo', label: 'To Do', color: 'bg-blue-100' },
  { status: 'in_progress', label: 'In Progress', color: 'bg-yellow-100' },
  { status: 'review', label: 'Review', color: 'bg-purple-100' },
  { status: 'done', label: 'Done', color: 'bg-green-100' },
];

export default function KanbanBoard({ initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((task) => task.status === status);
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

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {statusColumns.map((column) => {
        const columnTasks = getTasksByStatus(column.status);

        return (
          <div key={column.status} className="flex-shrink-0 w-80">
            <div className={`${column.color} rounded-t-lg p-3 border-b-2 border-gray-300`}>
              <h2 className="font-semibold text-gray-700">
                {column.label}
                <span className="ml-2 text-sm text-gray-500">({columnTasks.length})</span>
              </h2>
            </div>

            <div className="bg-gray-50 rounded-b-lg p-3 min-h-[500px] space-y-3">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  className={`bg-white rounded-lg p-4 shadow-sm border-l-4 ${getPriorityColor(
                    task.priority
                  )} hover:shadow-md transition-shadow cursor-pointer`}
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
                </div>
              ))}

              {columnTasks.length === 0 && (
                <div className="text-center text-gray-400 text-sm py-8">No tasks</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
