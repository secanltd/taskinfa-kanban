'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, SessionWithDetails } from '@taskinfa/shared';

interface WorkerStatus {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'offline' | 'error';
  current_task: {
    id: string;
    title: string | null;
  } | null;
}

interface SessionStats {
  active: number;
  idle: number;
  stuck: number;
  completed: number;
  error: number;
}

interface UseTaskStreamOptions {
  onTasksUpdated?: (tasks: Task[]) => void;
  onWorkersUpdated?: (workers: WorkerStatus[]) => void;
  onSessionsUpdated?: (sessions: SessionWithDetails[]) => void;
  enabled?: boolean;
}

interface UseTaskStreamReturn {
  workers: WorkerStatus[];
  sessions: SessionWithDetails[];
  sessionStats: SessionStats;
  connected: boolean;
  onlineCount: number;
  workingCount: number;
  reconnect: () => void;
}

const POLL_INTERVAL_MS = 5000;

const DEFAULT_SESSION_STATS: SessionStats = { active: 0, idle: 0, stuck: 0, completed: 0, error: 0 };

export function useTaskStream(options: UseTaskStreamOptions = {}): UseTaskStreamReturn {
  const { onTasksUpdated, onWorkersUpdated, onSessionsUpdated, enabled = true } = options;

  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [sessions, setSessions] = useState<SessionWithDetails[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats>(DEFAULT_SESSION_STATS);
  const [connected, setConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [workingCount, setWorkingCount] = useState(0);

  const onTasksUpdatedRef = useRef(onTasksUpdated);
  onTasksUpdatedRef.current = onTasksUpdated;
  const onWorkersUpdatedRef = useRef(onWorkersUpdated);
  onWorkersUpdatedRef.current = onWorkersUpdated;
  const onSessionsUpdatedRef = useRef(onSessionsUpdated);
  onSessionsUpdatedRef.current = onSessionsUpdated;

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
      const [tasksRes, sessionsRes] = await Promise.all([
        fetch('/api/tasks?limit=100'),
        fetch('/api/sessions'),
      ]);

      if (!tasksRes.ok) {
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

      // --- Sessions ---
      if (sessionsRes.ok) {
        const sessionsData: {
          sessions: SessionWithDetails[];
          stats: SessionStats;
        } = await sessionsRes.json();

        setSessions(sessionsData.sessions);
        setSessionStats(sessionsData.stats);

        // Derive worker-compatible counts from sessions
        setOnlineCount(sessionsData.stats.active + sessionsData.stats.idle);
        setWorkingCount(sessionsData.stats.active);

        if (onSessionsUpdatedRef.current) {
          onSessionsUpdatedRef.current(sessionsData.sessions);
        }
      }
    } catch {
      setConnected(false);
    }
  }, []);

  const startPolling = useCallback(() => {
    cleanup();
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
    sessions,
    sessionStats,
    connected,
    onlineCount,
    workingCount,
    reconnect,
  };
}

export type { WorkerStatus, SessionStats, UseTaskStreamReturn };
