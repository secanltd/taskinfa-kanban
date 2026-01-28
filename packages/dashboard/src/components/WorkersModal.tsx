'use client';

import { useEffect, useCallback } from 'react';
import type { WorkerStatus } from '@/hooks/useTaskStream';
import { formatWorkerName, getWorkerInitials } from '@/utils/formatWorkerName';

interface WorkersModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: WorkerStatus[];
  connected: boolean;
  onlineCount: number;
  workingCount: number;
  onReconnect?: () => void;
}

export default function WorkersModal({
  isOpen,
  onClose,
  workers,
  connected,
  onlineCount,
  workingCount,
  onReconnect,
}: WorkersModalProps) {
  const offlineWorkers = workers.filter(w => w.status === 'offline');
  const onlineWorkers = workers.filter(w => w.status !== 'offline');

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'bg-terminal-blue';
      case 'idle':
        return 'bg-terminal-green';
      case 'error':
        return 'bg-terminal-red';
      default:
        return 'bg-terminal-muted';
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

  const getAvatarBg = (status: string) => {
    switch (status) {
      case 'working':
        return 'bg-terminal-blue/20 text-terminal-blue';
      case 'idle':
        return 'bg-terminal-green/20 text-terminal-green';
      case 'error':
        return 'bg-terminal-red/20 text-terminal-red';
      default:
        return 'bg-terminal-muted/20 text-terminal-muted';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-terminal-surface border border-terminal-border rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-terminal-border">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-terminal-text">Workers</h2>
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  connected ? 'bg-terminal-green animate-pulse' : 'bg-terminal-red'
                }`}
              />
              <span className="text-xs text-terminal-muted">
                {connected ? 'Live' : 'Disconnected'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-terminal-muted hover:text-terminal-text transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-terminal-border">
          <div className="bg-terminal-green/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-terminal-green">{onlineCount}</div>
            <div className="text-xs text-terminal-green/80">Online</div>
          </div>
          <div className="bg-terminal-blue/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-terminal-blue">{workingCount}</div>
            <div className="text-xs text-terminal-blue/80">Working</div>
          </div>
          <div className="bg-terminal-muted/10 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-terminal-muted">{offlineWorkers.length}</div>
            <div className="text-xs text-terminal-muted/80">Offline</div>
          </div>
        </div>

        {/* Worker List */}
        <div className="overflow-y-auto max-h-[400px] scrollbar-thin">
          {workers.length === 0 ? (
            <div className="text-center text-terminal-muted py-12">
              <div className="text-4xl mb-3">🤖</div>
              <p>No workers registered</p>
            </div>
          ) : (
            <div className="divide-y divide-terminal-border">
              {/* Online workers */}
              {onlineWorkers.map((worker) => (
                <div
                  key={worker.id}
                  className="flex items-center gap-4 p-4 hover:bg-terminal-surface-hover transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${getAvatarBg(worker.status)}`}>
                    {getWorkerInitials(worker.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-terminal-text">
                        {formatWorkerName(worker.name)}
                      </span>
                      <span className={`w-2 h-2 rounded-full ${getStatusColor(worker.status)}`} />
                    </div>
                    {worker.current_task ? (
                      <div className="text-sm text-terminal-muted truncate">
                        Working on: {worker.current_task.title}
                      </div>
                    ) : (
                      <div className="text-sm text-terminal-muted">
                        {getStatusLabel(worker.status)}
                      </div>
                    )}
                  </div>
                  <div className={`text-xs font-medium px-2 py-1 rounded ${
                    worker.status === 'working'
                      ? 'bg-terminal-blue/20 text-terminal-blue'
                      : worker.status === 'idle'
                      ? 'bg-terminal-green/20 text-terminal-green'
                      : worker.status === 'error'
                      ? 'bg-terminal-red/20 text-terminal-red'
                      : 'bg-terminal-muted/20 text-terminal-muted'
                  }`}>
                    {getStatusLabel(worker.status)}
                  </div>
                </div>
              ))}

              {/* Offline workers */}
              {offlineWorkers.length > 0 && (
                <>
                  <div className="px-4 py-2 bg-terminal-bg text-xs text-terminal-muted font-medium uppercase tracking-wider">
                    Offline
                  </div>
                  {offlineWorkers.map((worker) => (
                    <div
                      key={worker.id}
                      className="flex items-center gap-4 p-4 opacity-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-terminal-muted/10 flex items-center justify-center text-terminal-muted font-semibold text-sm">
                        {getWorkerInitials(worker.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-terminal-muted">
                          {formatWorkerName(worker.name)}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!connected && onReconnect && (
          <div className="px-6 py-4 border-t border-terminal-border bg-terminal-bg">
            <button
              onClick={onReconnect}
              className="w-full btn-primary"
            >
              Reconnect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
