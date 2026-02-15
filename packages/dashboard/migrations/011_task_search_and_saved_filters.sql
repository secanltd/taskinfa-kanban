-- Migration: Add task full-text search and saved filters
-- Date: 2026-02-14

-- FTS5 virtual table for full-text search across task title, description, and labels
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  task_id UNINDEXED,
  title,
  description,
  labels,
  content='tasks',
  content_rowid='rowid'
);

-- Populate FTS index from existing tasks
INSERT INTO tasks_fts(task_id, title, description, labels)
  SELECT id, title, COALESCE(description, ''), COALESCE(labels, '[]') FROM tasks;

-- Triggers to keep FTS index in sync (content-sync requires 'delete' command)

-- After INSERT
CREATE TRIGGER tasks_fts_insert AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, task_id, title, description, labels)
    VALUES (NEW.rowid, NEW.id, NEW.title, COALESCE(NEW.description, ''), COALESCE(NEW.labels, '[]'));
END;

-- After UPDATE (delete old, insert new)
CREATE TRIGGER tasks_fts_update AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, task_id, title, description, labels)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.title, COALESCE(OLD.description, ''), COALESCE(OLD.labels, '[]'));
  INSERT INTO tasks_fts(rowid, task_id, title, description, labels)
    VALUES (NEW.rowid, NEW.id, NEW.title, COALESCE(NEW.description, ''), COALESCE(NEW.labels, '[]'));
END;

-- After DELETE
CREATE TRIGGER tasks_fts_delete AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, task_id, title, description, labels)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.title, COALESCE(OLD.description, ''), COALESCE(OLD.labels, '[]'));
END;

-- Saved filters table
CREATE TABLE IF NOT EXISTS saved_filters (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filters TEXT NOT NULL DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_user ON saved_filters(user_id, workspace_id);
