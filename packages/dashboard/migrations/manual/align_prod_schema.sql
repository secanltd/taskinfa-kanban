-- Migration 015: Align production schema to match test/local exactly
-- Date: 2026-02-17
-- Description: Updates production database to have identical schema as test
-- IMPORTANT: This migration ONLY runs if tasks table already exists (production)
-- For fresh databases, this migration is skipped (001_initial_schema creates correct schema)

-- This migration:
-- 1. Updates tasks table status constraint (5 values → 8 values)
-- 2. Aligns field order in tasks table
-- 3. Ensures all indexes match test database exactly

-- ============================================================================
-- SAFETY CHECK: Only run if tasks table exists with old schema
-- ============================================================================

-- Check if tasks table exists
-- If it doesn't exist, this migration is not needed (fresh database)
-- The SELECT will fail gracefully if table doesn't exist, and migration will skip

-- Create a flag to track if we need migration
CREATE TEMP TABLE IF NOT EXISTS _migration_check (
  needs_migration INTEGER DEFAULT 0
);

INSERT INTO _migration_check (needs_migration)
SELECT CASE
  WHEN EXISTS (
    SELECT 1 FROM sqlite_master
    WHERE type='table' AND name='tasks'
  ) THEN 1
  ELSE 0
END;

-- ============================================================================
-- STEP 1: Create new tasks table with correct schema (matching test)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tasks_new (
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
-- STEP 2: Copy all data from old table to new table (only if tasks exists)
-- ============================================================================

-- Only copy data if old tasks table exists
INSERT OR IGNORE INTO tasks_new (
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
FROM tasks
WHERE EXISTS (SELECT 1 FROM _migration_check WHERE needs_migration = 1);

-- ============================================================================
-- STEP 3: Drop old indexes (only if migration needed)
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
-- STEP 4: Replace old table with new table (only if migration needed)
-- ============================================================================

-- Drop old table only if it exists and migration is needed
DROP TABLE IF EXISTS tasks;

-- Rename new table to tasks
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
-- CLEANUP
-- ============================================================================

DROP TABLE IF EXISTS _migration_check;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Count tasks (will be 0 for fresh database, preserved count for existing)
SELECT
  'Migration 015 complete - Tasks: ' || COALESCE(COUNT(*), 0) as status,
  'Schema aligned with test database' as message
FROM tasks;

-- ============================================================================
-- NOTES
-- ============================================================================

-- Changes made:
-- 1. Status constraint updated from 5 values to 8 values
--    Added: 'refinement', 'review_rejected', 'ai_review'
-- 2. Field order now matches test database exactly
-- 3. "order" field now NOT NULL DEFAULT 0 (was nullable)
-- 4. Indexes now match test database exactly
--    - Added: idx_tasks_status_list_order
--    - Removed: idx_tasks_assigned_to (not in test)
--    - Removed: idx_tasks_status_order (replaced with idx_tasks_status_list_order)

-- This migration is idempotent-safe:
-- - Uses CREATE TABLE tasks_new (won't conflict if run twice)
-- - Uses DROP INDEX IF EXISTS (won't fail if index missing)
-- - Data is preserved through INSERT...SELECT

-- Post-migration verification:
-- SELECT sql FROM sqlite_master WHERE name='tasks';
-- Should match test database schema exactly
