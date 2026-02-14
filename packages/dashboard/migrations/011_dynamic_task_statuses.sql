-- Migration: Add dynamic task statuses for feature toggles
-- Date: 2026-02-14
-- Adds new status values: refinement, ai_review, review_rejected
-- These statuses are gated by feature toggles (refinement, ai_review)

-- SQLite doesn't support ALTER TABLE ... ALTER CONSTRAINT, so we need to
-- recreate the table to update the CHECK constraint.

-- Step 1: Create new tasks table with expanded status CHECK constraint
CREATE TABLE tasks_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_list_id TEXT REFERENCES task_lists(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog', 'refinement', 'todo', 'review_rejected', 'in_progress', 'ai_review', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  labels TEXT NOT NULL DEFAULT '[]',
  assignee TEXT,
  assigned_to TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,

  -- Execution metadata
  loop_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  files_changed TEXT NOT NULL DEFAULT '[]',
  completion_notes TEXT,

  -- PR integration
  pr_url TEXT,
  branch_name TEXT,

  -- Time tracking
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

-- Step 5: Recreate indexes
CREATE INDEX idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_workspace_created ON tasks(workspace_id, created_at DESC);
CREATE INDEX idx_tasks_task_list ON tasks(task_list_id);
CREATE INDEX idx_tasks_status_list_order ON tasks(status, task_list_id, "order");
