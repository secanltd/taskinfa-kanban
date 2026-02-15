-- Migration 010: Feature toggles system
-- Allows enabling/disabling features per workspace with optional JSON config

CREATE TABLE feature_toggles (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, feature_key)
);

CREATE INDEX idx_feature_toggles_workspace ON feature_toggles(workspace_id);
CREATE INDEX idx_feature_toggles_key ON feature_toggles(workspace_id, feature_key);
