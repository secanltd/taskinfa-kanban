-- Taskinfa-Bot Database Schema for Cloudflare D1
-- SQLite-compatible schema with optimizations for D1

-- Drop existing tables if they exist (for clean migrations)
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS workspaces;

-- Workspaces table
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Tasks table with kanban status
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  labels TEXT NOT NULL DEFAULT '[]', -- JSON array
  assignee TEXT,

  -- Execution metadata
  loop_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  files_changed TEXT NOT NULL DEFAULT '[]', -- JSON array
  completion_notes TEXT,

  -- Time tracking
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- API Keys table for authentication
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_workspace_created ON tasks(workspace_id, created_at DESC);
CREATE INDEX idx_api_keys_workspace ON api_keys(workspace_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- Insert default workspace for testing
INSERT INTO workspaces (id, name, description) VALUES
  ('default', 'Default Workspace', 'Default workspace for testing');

-- Insert sample tasks
INSERT INTO tasks (id, workspace_id, title, description, status, priority) VALUES
  ('task_1', 'default', 'Setup project structure', 'Initialize the project with proper folder structure and dependencies', 'done', 'high'),
  ('task_2', 'default', 'Create database schema', 'Design and implement D1 database schema', 'done', 'high'),
  ('task_3', 'default', 'Build kanban UI', 'Create React components for kanban board', 'todo', 'medium'),
  ('task_4', 'default', 'Implement MCP server', 'Create MCP server with task management tools', 'todo', 'high');
