-- Migration 014: Fix task_comments comment_type CHECK constraint
-- Date: 2026-02-15
-- Description: Adds 'human_message' and 'comment' to task_comments comment_type.
--              'human_message' is used for user replies in async chat.
--              'comment' is used for regular user comments that should NOT trigger AI sessions.
--              This migration is safe to run even if 013 partially failed.

-- Drop leftover temp table from any failed previous migration attempt
DROP TABLE IF EXISTS task_comments_new;

-- Recreate task_comments with updated CHECK constraint
-- (SQLite doesn't support ALTER CONSTRAINT, so we recreate the table)
CREATE TABLE task_comments_new (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  author TEXT NOT NULL,
  author_type TEXT NOT NULL CHECK(author_type IN ('bot', 'user')),
  content TEXT NOT NULL,
  comment_type TEXT NOT NULL CHECK(comment_type IN ('progress', 'question', 'summary', 'error', 'human_message', 'comment')),
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
