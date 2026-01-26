-- Migration 002: Add task comments and bot assignment
-- Date: 2026-01-26
-- Description: Adds assigned_to field for bot assignment and task_comments table for bot-to-human communication

-- Add assigned_to column to tasks table
-- This tracks which bot is currently working on the task
ALTER TABLE tasks ADD COLUMN assigned_to TEXT;

-- Create index for bot assignment queries
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);

-- Create task_comments table
-- Enables bots to write progress updates, questions, summaries, and error logs
CREATE TABLE task_comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  author TEXT NOT NULL,              -- Bot name (e.g., "Bot-John") or "user"
  author_type TEXT NOT NULL CHECK(author_type IN ('bot', 'user')),
  content TEXT NOT NULL,
  comment_type TEXT NOT NULL CHECK(comment_type IN ('progress', 'question', 'summary', 'error')),
  loop_number INTEGER,               -- Which execution loop this comment is from
  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Indexes for efficient comment queries
CREATE INDEX idx_comments_task ON task_comments(task_id, created_at DESC);
CREATE INDEX idx_comments_author ON task_comments(author);
CREATE INDEX idx_comments_type ON task_comments(comment_type);
