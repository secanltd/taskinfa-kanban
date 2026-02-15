-- Migration 013: Add claude_session_id to tasks + update task_comments CHECK constraint
-- Date: 2026-02-15
-- Description: Adds claude_session_id for persistent Claude session resumption per task,
--              and adds 'human_message' to task_comments comment_type for async chat.

-- Add claude_session_id to tasks
ALTER TABLE tasks ADD COLUMN claude_session_id TEXT;

-- Recreate task_comments with updated CHECK constraint
-- (SQLite doesn't support ALTER CONSTRAINT, so we recreate the table)
CREATE TABLE task_comments_new (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  author TEXT NOT NULL,
  author_type TEXT NOT NULL CHECK(author_type IN ('bot', 'user')),
  content TEXT NOT NULL,
  comment_type TEXT NOT NULL CHECK(comment_type IN ('progress', 'question', 'summary', 'error', 'human_message')),
  loop_number INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

INSERT INTO task_comments_new SELECT * FROM task_comments;
DROP TABLE task_comments;
ALTER TABLE task_comments_new RENAME TO task_comments;

-- Recreate indexes
CREATE INDEX idx_comments_task ON task_comments(task_id, created_at DESC);
CREATE INDEX idx_comments_author ON task_comments(author);
CREATE INDEX idx_comments_type ON task_comments(comment_type);
