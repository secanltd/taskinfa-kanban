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

const POLL_INTERVAL_MS = 5000;

export function useTaskStream(options: UseTaskStreamOptions = {}): UseTaskStreamReturn {
  const { onTasksUpdated, onWorkersUpdated, enabled = true } = options;

  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [workingCount, setWorkingCount] = useState(0);

  // Stable refs for callbacks so the interval doesn't re-create on every render
  const onTasksUpdatedRef = useRef(onTasksUpdated);
  onTasksUpdatedRef.current = onTasksUpdated;
  const onWorkersUpdatedRef = useRef(onWorkersUpdated);
  onWorkersUpdatedRef.current = onWorkersUpdated;

  // Track previous task data to detect changes
  const lastTasksJsonRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const poll = useCallback(async () => {
    try {
      const [tasksRes, workersRes] = await Promise.all([
        fetch('/api/tasks?limit=100'),
        fetch('/api/workers'),
      ]);

      if (!tasksRes.ok || !workersRes.ok) {
        setConnected(false);
        return;
      }

      setConnected(true);

      // --- Tasks ---
      const tasksData: { tasks: Task[] } = await tasksRes.json();
      const tasksJson = JSON.stringify(tasksData.tasks);

      if (tasksJson !== lastTasksJsonRef.current) {
        lastTasksJsonRef.current = tasksJson;
        if (onTasksUpdatedRef.current && tasksData.tasks.length > 0) {
          onTasksUpdatedRef.current(tasksData.tasks);
        }
      }

      // --- Workers ---
      const workersData: {
        workers: WorkerStatus[];
        stats: { online: number; working: number };
      } = await workersRes.json();

      setWorkers(workersData.workers);
      setOnlineCount(workersData.stats.online);
      setWorkingCount(workersData.stats.working);

      if (onWorkersUpdatedRef.current) {
        onWorkersUpdatedRef.current(workersData.workers);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    cleanup();
    // Fire immediately, then set up interval
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [poll, cleanup]);

  const reconnect = useCallback(() => {
    startPolling();
  }, [startPolling]);

  useEffect(() => {
    if (enabled) {
      startPolling();
    } else {
      cleanup();
      setConnected(false);
    }
    return cleanup;
  }, [enabled, startPolling, cleanup]);

  return {
    workers,
    connected,
    onlineCount,
    workingCount,
    reconnect,
  };
}

export type { WorkerStatus, UseTaskStreamReturn };
