-- Migration 008: Add PR integration fields to tasks
-- Stores GitHub PR URL and branch name set by the orchestrator agent

ALTER TABLE tasks ADD COLUMN pr_url TEXT;
ALTER TABLE tasks ADD COLUMN branch_name TEXT;
