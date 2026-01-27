-- Migration: Add workers table for tracking worker health and status
-- Date: 2026-01-27
-- Description: Workers are Docker containers running Claude Code that execute tasks

-- Workers table
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'offline' CHECK(status IN ('idle', 'working', 'offline', 'error')),
  current_task_id TEXT,
  last_heartbeat TEXT,
  total_tasks_completed INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (current_task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_workers_workspace ON workers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workers_status ON workers(status);
CREATE INDEX IF NOT EXISTS idx_workers_name ON workers(workspace_id, name);
CREATE INDEX IF NOT EXISTS idx_workers_heartbeat ON workers(last_heartbeat);
