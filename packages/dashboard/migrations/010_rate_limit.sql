-- Migration: Add rate limiting table
-- Date: 2026-02-14
-- Uses D1 for sliding window rate limit tracking

CREATE TABLE IF NOT EXISTS rate_limit_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,           -- e.g. "ip:1.2.3.4:auth" or "apikey:abc123:general"
  timestamp INTEGER NOT NULL,  -- Unix epoch ms
  expires_at INTEGER NOT NULL  -- Unix epoch ms for cleanup
);

CREATE INDEX idx_rate_limit_key_ts ON rate_limit_entries(key, timestamp);
CREATE INDEX idx_rate_limit_expires ON rate_limit_entries(expires_at);
