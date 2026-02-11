-- Migration 006: V2 Sessions and Events
-- Date: 2026-02-11
-- Description: Replace Docker worker model with Claude Code session tracking.
-- Adds sessions, session_events, and notification_config tables.
-- Adds slug and is_active columns to task_lists.

-- Sessions table (replaces workers table)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  project_id TEXT,
  current_task_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'idle', 'stuck', 'completed', 'error')),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_event_at TEXT DEFAULT (datetime('now')),
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (project_id) REFERENCES task_lists(id) ON DELETE SET NULL,
  FOREIGN KEY (current_task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_workspace_status ON sessions(workspace_id, status);

-- Session events table (granular event stream from Claude hooks)
CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  task_id TEXT,
  event_type TEXT NOT NULL CHECK(event_type IN ('task_claimed', 'task_progress', 'task_completed', 'stuck', 'needs_input', 'error', 'session_start', 'session_end', 'notification')),
  message TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_session_events_task ON session_events(task_id);
CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_session_events_created ON session_events(created_at DESC);

-- Notification config table (per-workspace Telegram settings)
CREATE TABLE IF NOT EXISTS notification_config (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL UNIQUE,
  telegram_chat_id TEXT,
  telegram_enabled INTEGER NOT NULL DEFAULT 0,
  notify_on_complete INTEGER NOT NULL DEFAULT 1,
  notify_on_stuck INTEGER NOT NULL DEFAULT 1,
  notify_on_error INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_config_workspace ON notification_config(workspace_id);

-- Add slug and is_active columns to task_lists
ALTER TABLE task_lists ADD COLUMN slug TEXT;
ALTER TABLE task_lists ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_task_lists_slug ON task_lists(slug);
CREATE INDEX IF NOT EXISTS idx_task_lists_active ON task_lists(workspace_id, is_active);
