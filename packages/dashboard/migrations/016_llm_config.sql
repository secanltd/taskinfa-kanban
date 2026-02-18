-- Migration 016: LLM provider configuration
-- Adds workspace-level credential store and session-type routing for LLM providers.
-- Enables routing orchestrator sessions to Ollama, LM Studio, OpenRouter, LiteLLM, or custom endpoints.

CREATE TABLE llm_providers (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  -- 'anthropic'|'ollama'|'lmstudio'|'openrouter'|'litellm'|'custom'
  provider TEXT NOT NULL,
  -- NULL for anthropic (uses api.anthropic.com)
  base_url TEXT,
  -- NULL for anthropic/ollama/lmstudio (no key required); stored plaintext (internal tool)
  auth_token TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(workspace_id, provider),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE llm_session_config (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  -- NULL = workspace-global default; non-null = per-project override
  task_list_id TEXT,
  -- 'task'|'ai_review'|'fix_review'|'testing'|'fix_test_failure'|'refinement'|'message'
  session_type TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'anthropic',
  -- NULL = use provider's default model
  model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (task_list_id) REFERENCES task_lists(id) ON DELETE CASCADE
);

-- Partial unique indexes to handle NULL task_list_id correctly in SQLite
CREATE UNIQUE INDEX idx_llm_session_global
  ON llm_session_config(workspace_id, session_type)
  WHERE task_list_id IS NULL;

CREATE UNIQUE INDEX idx_llm_session_project
  ON llm_session_config(workspace_id, task_list_id, session_type)
  WHERE task_list_id IS NOT NULL;

CREATE INDEX idx_llm_session_workspace ON llm_session_config(workspace_id);
CREATE INDEX idx_llm_session_task_list ON llm_session_config(task_list_id);
