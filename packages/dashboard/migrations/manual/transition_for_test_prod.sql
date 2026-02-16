-- Migration: Initialize migration tracking for existing database
-- Date: 2026-02-17
-- Author: SECAN Engineering
--
-- IMPORTANT: This is a ONE-TIME transition migration
-- Purpose: Populate d1_migrations table with already-applied migrations
--
-- Context:
-- All migrations 002-014 were previously applied using 'wrangler d1 execute --file'
-- which did NOT track migrations in d1_migrations table.
-- This migration creates the tracking table and marks those migrations as applied.

-- Create d1_migrations table (if it doesn't exist)
-- D1 automatically creates this table when using 'migrations apply',
-- but we create it here to ensure it exists before inserting records
CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mark all previously-applied migrations as complete
-- These were applied manually using 'wrangler d1 execute --file'
INSERT OR IGNORE INTO d1_migrations (name, applied_at) VALUES
  ('001_initial_schema.sql', '2026-01-01 00:00:00'),
  ('002_add_comments.sql', '2026-01-01 00:00:00'),
  ('003_add_users.sql', '2026-01-01 00:00:00'),
  ('004_add_task_lists_and_order.sql', '2026-01-01 00:00:00'),
  ('005_add_workers.sql', '2026-01-01 00:00:00'),
  ('006_v2_sessions_events.sql', '2026-01-01 00:00:00'),
  ('007_api_key_preview.sql', '2026-01-01 00:00:00'),
  ('008_task_pr_fields.sql', '2026-01-01 00:00:00'),
  ('009_task_lists_initialized.sql', '2026-01-01 00:00:00'),
  ('010_feature_toggles.sql', '2026-01-01 00:00:00'),
  ('010_rate_limit.sql', '2026-01-01 00:00:00'),
  ('011_dynamic_task_statuses.sql', '2026-01-01 00:00:00'),
  ('011_task_search_and_saved_filters.sql', '2026-01-01 00:00:00'),
  ('012_subtasks_and_dependencies.sql', '2026-01-01 00:00:00'),
  ('013_claude_session_and_comments.sql', '2026-01-01 00:00:00'),
  ('014_fix_comment_type_constraint.sql', '2026-01-01 00:00:00');

-- Verify all migrations are tracked
SELECT 'Migration tracking initialized. Already-applied migrations:' as status;
SELECT name, applied_at FROM d1_migrations ORDER BY name;
