-- Migration 007: Add key_preview column to api_keys
-- Stores first 8 + last 4 chars of actual key for display purposes
ALTER TABLE api_keys ADD COLUMN key_preview TEXT;
