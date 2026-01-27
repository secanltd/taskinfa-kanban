'use client';

import type { WorkerStatus } from '@/hooks/useTaskStream';

interface WorkerStatusPanelProps {
  workers: WorkerStatus[];
  connected: boolean;
  onlineCount: number;
  workingCount: number;
  onReconnect?: () => void;
}

export default function WorkerStatusPanel({
  workers,
  connected,
  onlineCount,
  workingCount,
  onReconnect,
}: WorkerStatusPanelProps) {
  const offlineWorkers = workers.filter(w => w.status === 'offline');
  const onlineWorkers = workers.filter(w => w.status !== 'offline');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'bg-blue-500';
      case 'idle':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'working':
        return 'Working';
      case 'idle':
        return 'Idle';
      case 'error':
        return 'Error';
      default:
        return 'Offline';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4">
      {/* Header with connection status */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Workers</h3>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-xs text-gray-500">
            {connected ? 'Live' : 'Disconnected'}
          </span>
          {!connected && onReconnect && (
            <button
              onClick={onReconnect}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="bg-green-50 rounded p-2">
          <div className="text-lg font-bold text-green-700">{onlineCount}</div>
          <div className="text-xs text-green-600">Online</div>
        </div>
        <div className="bg-blue-50 rounded p-2">
          <div className="text-lg font-bold text-blue-700">{workingCount}</div>
          <div className="text-xs text-blue-600">Working</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-lg font-bold text-gray-700">{offlineWorkers.length}</div>
          <div className="text-xs text-gray-600">Offline</div>
        </div>
      </div>

      {/* Worker list */}
      {workers.length === 0 ? (
        <div className="text-center text-gray-400 text-sm py-4">
          No workers registered
        </div>
      ) : (
        <div className="space-y-2">
          {/* Online workers first */}
          {onlineWorkers.map((worker) => (
            <div
              key={worker.id}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${getStatusColor(worker.status)}`}
                />
                <span className="font-medium text-gray-900">{worker.name}</span>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-medium ${
                    worker.status === 'working'
                      ? 'text-blue-600'
                      : worker.status === 'idle'
                      ? 'text-green-600'
                      : 'text-gray-500'
                  }`}
                >
                  {getStatusLabel(worker.status)}
                </span>
                {worker.current_task && (
                  <div className="text-xs text-gray-500 truncate max-w-[150px]">
                    {worker.current_task.title}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Offline workers */}
          {offlineWorkers.length > 0 && (
            <div className="pt-2 border-t">
              <div className="text-xs text-gray-400 mb-1">Offline</div>
              {offlineWorkers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center justify-between p-2 opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                    <span className="text-gray-600">{worker.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
