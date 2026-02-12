-- Migration: Add is_initialized flag to task_lists
-- Tracks whether the orchestrator has cloned the project repo

ALTER TABLE task_lists ADD COLUMN is_initialized INTEGER NOT NULL DEFAULT 0;
