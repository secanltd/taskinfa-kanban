'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task } from '@taskinfa/shared';

interface WorkerStatus {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'offline' | 'error';
  current_task: {
    id: string;
    title: string | null;
  } | null;
}

interface WorkersStatusEvent {
  workers: WorkerStatus[];
  online_count: number;
  working_count: number;
}

interface TasksUpdatedEvent {
  tasks: Task[];
  count: number;
}

interface UseTaskStreamOptions {
  onTasksUpdated?: (tasks: Task[]) => void;
  onWorkersUpdated?: (workers: WorkerStatus[]) => void;
  enabled?: boolean;
}

interface UseTaskStreamReturn {
  workers: WorkerStatus[];
  connected: boolean;
  onlineCount: number;
  workingCount: number;
  reconnect: () => void;
}

export function useTaskStream(options: UseTaskStreamOptions = {}): UseTaskStreamReturn {
  const { onTasksUpdated, onWorkersUpdated, enabled = true } = options;

  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [workingCount, setWorkingCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled) return;

    cleanup();

    const es = new EventSource('/api/tasks/stream');
    eventSourceRef.current = es;

    es.addEventListener('connected', (e) => {
      setConnected(true);
      reconnectAttempts.current = 0;
      console.log('[SSE] Connected to task stream');
    });

    es.addEventListener('tasks:updated', (e) => {
      try {
        const data: TasksUpdatedEvent = JSON.parse(e.data);
        if (onTasksUpdated && data.tasks.length > 0) {
          onTasksUpdated(data.tasks);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse tasks:updated event', err);
      }
    });

    es.addEventListener('workers:status', (e) => {
      try {
        const data: WorkersStatusEvent = JSON.parse(e.data);
        setWorkers(data.workers);
        setOnlineCount(data.online_count);
        setWorkingCount(data.working_count);
        if (onWorkersUpdated) {
          onWorkersUpdated(data.workers);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse workers:status event', err);
      }
    });

    es.addEventListener('heartbeat', () => {
      // Connection is alive
    });

    es.addEventListener('error', (e) => {
      console.error('[SSE] Stream error', e);
    });

    es.onerror = () => {
      setConnected(false);
      cleanup();

      // Exponential backoff reconnection
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;

      console.log(`[SSE] Disconnected. Reconnecting in ${delay / 1000}s...`);
      reconnectTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [enabled, onTasksUpdated, onWorkersUpdated, cleanup]);

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      cleanup();
    };
  }, [enabled, connect, cleanup]);

  return {
    workers,
    connected,
    onlineCount,
    workingCount,
    reconnect,
  };
}

export type { WorkerStatus, UseTaskStreamReturn };
