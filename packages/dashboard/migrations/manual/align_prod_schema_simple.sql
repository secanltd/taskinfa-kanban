-- Migration 015: Align production schema to match test/local exactly
-- Date: 2026-02-17
-- Description: Updates production database to have identical schema as test
-- PRODUCTION ONLY - Test database already has correct schema

-- This migration:
-- 1. Updates tasks table status constraint (5 values → 8 values)
-- 2. Aligns field order in tasks table
-- 3. Ensures all indexes match test database exactly

-- ============================================================================
-- STEP 1: Create new tasks table with correct schema (matching test)
-- ============================================================================

CREATE TABLE tasks_new (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  task_list_id TEXT REFERENCES task_lists(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'backlog'
    CHECK(status IN ('backlog', 'refinement', 'todo', 'review_rejected', 'in_progress', 'ai_review', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
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

  parent_task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- ============================================================================
-- STEP 2: Copy all data from old table to new table
-- ============================================================================

INSERT INTO tasks_new (
  id, workspace_id, task_list_id, title, description, status, priority,
  labels, assignee, assigned_to, "order", loop_count, error_count,
  files_changed, completion_notes, pr_url, branch_name, created_at,
  updated_at, started_at, completed_at, parent_task_id
)
SELECT
  id, workspace_id, task_list_id, title, description, status, priority,
  labels, assignee, assigned_to,
  COALESCE("order", 0) as "order",  -- Handle nullable order field
  loop_count, error_count,
  files_changed, completion_notes, pr_url, branch_name, created_at,
  updated_at, started_at, completed_at, parent_task_id
FROM tasks;

-- ============================================================================
-- STEP 3: Drop old indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_tasks_workspace_status;
DROP INDEX IF EXISTS idx_tasks_status;
DROP INDEX IF EXISTS idx_tasks_priority;
DROP INDEX IF EXISTS idx_tasks_workspace_created;
DROP INDEX IF EXISTS idx_tasks_assigned_to;
DROP INDEX IF EXISTS idx_tasks_parent_task;
DROP INDEX IF EXISTS idx_tasks_status_order;
DROP INDEX IF EXISTS idx_tasks_task_list;

-- ============================================================================
-- STEP 4: Replace old table with new table
-- ============================================================================

DROP TABLE tasks;
ALTER TABLE tasks_new RENAME TO tasks;

-- ============================================================================
-- STEP 5: Recreate indexes (matching test database exactly)
-- ============================================================================

CREATE INDEX idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority ON tasks(priority);
CREATE INDEX idx_tasks_workspace_created ON tasks(workspace_id, created_at DESC);
CREATE INDEX idx_tasks_parent_task ON tasks(parent_task_id);
CREATE INDEX idx_tasks_status_list_order ON tasks(status, task_list_id, "order");
CREATE INDEX idx_tasks_task_list ON tasks(task_list_id);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT
  'Migration 015 complete - Tasks: ' || COALESCE(COUNT(*), 0) as status,
  'Schema aligned with test database' as message
FROM tasks;
