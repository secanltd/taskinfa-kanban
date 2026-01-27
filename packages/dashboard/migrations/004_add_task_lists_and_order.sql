-- Migration 004: Add Task Lists and Task Ordering
-- This migration adds task lists (projects) and task ordering for priority management

-- Create task_lists table (represents projects)
CREATE TABLE IF NOT EXISTS task_lists (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  repository_url TEXT,
  working_directory TEXT DEFAULT '/workspace',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_lists_workspace ON task_lists(workspace_id);

-- Add task_list_id to tasks table
ALTER TABLE tasks ADD COLUMN task_list_id TEXT REFERENCES task_lists(id) ON DELETE SET NULL;

-- Add order column for task ordering within columns
ALTER TABLE tasks ADD COLUMN "order" INTEGER DEFAULT 0;

-- Create indexes for efficient querying
CREATE INDEX idx_tasks_task_list ON tasks(task_list_id);
CREATE INDEX idx_tasks_status_order ON tasks(status, task_list_id, "order");

-- Update existing tasks with sequential order based on creation date
WITH ordered_tasks AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY status ORDER BY created_at) as new_order
  FROM tasks
)
UPDATE tasks
SET "order" = (SELECT new_order FROM ordered_tasks WHERE ordered_tasks.id = tasks.id);

-- Create default task list for existing tasks
INSERT INTO task_lists (id, workspace_id, name, description)
VALUES ('default', 'default', 'Default Project', 'Default task list for tasks without a project');

-- Assign existing tasks to default list
UPDATE tasks SET task_list_id = 'default' WHERE task_list_id IS NULL;
