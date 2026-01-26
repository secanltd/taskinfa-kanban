-- Migration 003: Add user authentication system
-- Date: 2026-01-26
-- Description: Adds users table for authentication and links API keys to users

-- Create users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT,
  workspace_id TEXT NOT NULL UNIQUE,

  is_verified INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT,

  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

-- Add user_id column to api_keys table
ALTER TABLE api_keys ADD COLUMN user_id TEXT;

-- Add is_active column to api_keys table for soft deletion
ALTER TABLE api_keys ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_workspace ON users(workspace_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_active ON api_keys(is_active);

-- Note: Existing api_keys without user_id will remain valid
-- They can be associated with users manually or through a claim process
