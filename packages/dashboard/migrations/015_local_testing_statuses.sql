-- Migration: Add local_testing task statuses
-- Date: 2026-02-17
-- Adds status values: testing, test_failed
-- These statuses are gated by the local_testing feature toggle.

-- SQLite doesn't support ALTER TABLE ... ALTER CONSTRAINT, so we need to
-- recreate the table to update the CHECK constraint.

-- Step 1: Create new tasks table with expanded status CHECK constraint
CREATE TABLE tasks_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_list_id TEXT REFERENCES task_lists(id) ON DELETE SET NULL,
  parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN (
    'backlog', 'refinement', 'todo', 'review_rejected', 'test_failed',
    'in_progress', 'testing', 'ai_review', 'review', 'done'
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  labels TEXT NOT NULL DEFAULT '[]',
  assignee TEXT,
  assigned_to TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  loop_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  files_changed TEXT NOT NULL DEFAULT '[]',
  completion_notes TEXT,
  pr_url TEXT,
  branch_name TEXT,
  claude_session_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Step 2: Copy all data from old table
INSERT INTO tasks_new SELECT * FROM tasks;

-- Step 3: Drop old table
DROP TABLE tasks;

-- Step 4: Rename new table
ALTER TABLE tasks_new RENAME TO tasks;

-- Step 5: Recreate all indexes
CREATE INDEX idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_workspace_created ON tasks(workspace_id, created_at DESC);
CREATE INDEX idx_tasks_task_list ON tasks(task_list_id);
CREATE INDEX idx_tasks_status_list_order ON tasks(status, task_list_id, "order");
CREATE INDEX idx_tasks_parent_task ON tasks(parent_task_id);
