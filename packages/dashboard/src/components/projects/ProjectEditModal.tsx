'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  TaskList,
  LlmProvider,
  LlmSessionType,
  LlmSessionConfig,
} from '@taskinfa/shared';
import { LLM_PROVIDER_PRESETS, LLM_SESSION_TYPE_LABELS } from '@taskinfa/shared';

const PROVIDERS: LlmProvider[] = ['anthropic', 'ollama', 'lmstudio', 'openrouter', 'litellm', 'custom'];
const SESSION_TYPES: LlmSessionType[] = ['task', 'ai_review', 'fix_review', 'testing', 'fix_test_failure', 'refinement', 'message'];

interface Props {
  project: TaskList;
  onClose: () => void;
  onUpdated: (project: TaskList) => void;
}

type Tab = 'general' | 'llm';

interface SessionFormState {
  provider: LlmProvider | 'inherit';
  model: string;
  hasOverride: boolean;
}

export default function ProjectEditModal({ project, onClose, onUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  // General tab state
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [repositoryUrl, setRepositoryUrl] = useState(project.repository_url ?? '');
  const [generalSaving, setGeneralSaving] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // LLM tab state
  const [globalConfigs, setGlobalConfigs] = useState<LlmSessionConfig[]>([]);
  const [projectConfigs, setProjectConfigs] = useState<LlmSessionConfig[]>([]);
  const [sessionForms, setSessionForms] = useState<Record<string, SessionFormState>>({});
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [sessionSaving, setSessionSaving] = useState<Set<LlmSessionType>>(new Set());
  const [sessionSuccess, setSessionSuccess] = useState<Set<LlmSessionType>>(new Set());
  const [llmLoaded, setLlmLoaded] = useState(false);

  const fetchLlmConfig = useCallback(async () => {
    setLlmLoading(true);
    try {
      const res = await fetch('/api/llm-config');
      if (!res.ok) throw new Error('Failed to fetch LLM config');
      const data = await res.json() as { providers: unknown[]; session_configs: LlmSessionConfig[] };

      const globals = data.session_configs.filter((c) => c.task_list_id === null);
      const projectLevel = data.session_configs.filter((c) => c.task_list_id === project.id);
      setGlobalConfigs(globals);
      setProjectConfigs(projectLevel);

      // Build form state
      const forms: Record<string, SessionFormState> = {};
      for (const st of SESSION_TYPES) {
        const override = projectLevel.find((c) => c.session_type === st);
        if (override) {
          forms[st] = { provider: override.provider, model: override.model ?? '', hasOverride: true };
        } else {
          forms[st] = { provider: 'inherit', model: '', hasOverride: false };
        }
      }
      setSessionForms(forms);
      setLlmError(null);
    } catch {
      setLlmError('Failed to load LLM configuration');
    } finally {
      setLlmLoading(false);
      setLlmLoaded(true);
    }
  }, [project.id]);

  // Load LLM config when switching to the LLM tab for the first time
  useEffect(() => {
    if (activeTab === 'llm' && !llmLoaded) {
      fetchLlmConfig();
    }
  }, [activeTab, llmLoaded, fetchLlmConfig]);

  async function handleGeneralSave() {
    setGeneralSaving(true);
    setGeneralError(null);
    try {
      const res = await fetch(`/api/task-lists/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          repository_url: repositoryUrl || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed to update project');
      }
      const data = await res.json() as { task_list: TaskList };
      onUpdated(data.task_list);
    } catch (err) {
      setGeneralError(err instanceof Error ? err.message : 'Failed to update project');
    } finally {
      setGeneralSaving(false);
    }
  }

  async function saveSessionOverride(sessionType: LlmSessionType) {
    const form = sessionForms[sessionType];
    if (!form || form.provider === 'inherit') return;

    setSessionSaving((prev) => new Set(prev).add(sessionType));
    setSessionSuccess((prev) => { const next = new Set(prev); next.delete(sessionType); return next; });
    setLlmError(null);

    try {
      const res = await fetch('/api/llm-config/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_list_id: project.id,
          session_type: sessionType,
          provider: form.provider,
          model: form.model || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save session config');
      const data = await res.json() as { session_config: LlmSessionConfig };
      setProjectConfigs((prev) => {
        const filtered = prev.filter((c) => c.session_type !== sessionType);
        return [...filtered, data.session_config];
      });
      setSessionForms((prev) => ({
        ...prev,
        [sessionType]: { ...prev[sessionType], hasOverride: true },
      }));
      setSessionSuccess((prev) => new Set(prev).add(sessionType));
      setTimeout(() => {
        setSessionSuccess((prev) => { const next = new Set(prev); next.delete(sessionType); return next; });
      }, 2000);
    } catch {
      setLlmError(`Failed to save ${LLM_SESSION_TYPE_LABELS[sessionType]} config`);
    } finally {
      setSessionSaving((prev) => { const next = new Set(prev); next.delete(sessionType); return next; });
    }
  }

  async function clearOverride(sessionType: LlmSessionType) {
    setSessionSaving((prev) => new Set(prev).add(sessionType));
    setLlmError(null);

    try {
      const res = await fetch('/api/llm-config/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_list_id: project.id,
          session_type: sessionType,
        }),
      });
      if (!res.ok) throw new Error('Failed to clear override');
      setProjectConfigs((prev) => prev.filter((c) => c.session_type !== sessionType));
      setSessionForms((prev) => ({
        ...prev,
        [sessionType]: { provider: 'inherit', model: '', hasOverride: false },
      }));
    } catch {
      setLlmError(`Failed to clear ${LLM_SESSION_TYPE_LABELS[sessionType]} override`);
    } finally {
      setSessionSaving((prev) => { const next = new Set(prev); next.delete(sessionType); return next; });
    }
  }

  function updateSessionForm(sessionType: LlmSessionType, field: 'provider' | 'model', value: string) {
    setSessionForms((prev) => ({
      ...prev,
      [sessionType]: { ...prev[sessionType], [field]: value },
    }));
  }

  function getGlobalConfigLabel(sessionType: LlmSessionType): string {
    const global = globalConfigs.find((c) => c.session_type === sessionType);
    if (!global) return 'Anthropic / default';
    const providerLabel = LLM_PROVIDER_PRESETS[global.provider]?.label ?? global.provider;
    return `${providerLabel} / ${global.model || 'default'}`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-terminal-surface border border-terminal-border rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-terminal-border flex-shrink-0">
          <h2 className="text-lg font-semibold text-terminal-text">Edit Project</h2>
          <button
            onClick={onClose}
            className="text-terminal-muted hover:text-terminal-text transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-terminal-border flex-shrink-0">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'general'
                ? 'text-terminal-green border-b-2 border-terminal-green'
                : 'text-terminal-muted hover:text-terminal-text'
            }`}
          >
            General
          </button>
          <button
            onClick={() => setActiveTab('llm')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'llm'
                ? 'text-terminal-green border-b-2 border-terminal-green'
                : 'text-terminal-muted hover:text-terminal-text'
            }`}
          >
            LLM Settings
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'general' && (
            <div className="space-y-4">
              {generalError && (
                <div className="bg-terminal-red/10 border border-terminal-red/20 text-terminal-red rounded-lg px-4 py-3 text-sm">
                  {generalError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-terminal-muted mb-2">
                  Project Name <span className="text-terminal-red">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field w-full"
                  disabled={generalSaving}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-terminal-muted mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-field w-full min-h-[80px] resize-y"
                  disabled={generalSaving}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-terminal-muted mb-2">
                  Repository URL
                </label>
                <input
                  type="text"
                  value={repositoryUrl}
                  onChange={(e) => setRepositoryUrl(e.target.value)}
                  className="input-field w-full"
                  placeholder="https://github.com/yourorg/repo.git"
                  disabled={generalSaving}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleGeneralSave}
                  disabled={generalSaving || !name.trim()}
                  className="btn-primary"
                >
                  {generalSaving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={onClose} className="btn-secondary" disabled={generalSaving}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div>
              {llmError && (
                <div className="bg-terminal-red/10 border border-terminal-red/20 text-terminal-red rounded-lg px-4 py-3 text-sm mb-4">
                  {llmError}
                </div>
              )}

              {llmLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-terminal-green"></div>
                  <p className="text-sm text-terminal-muted mt-2">Loading LLM config...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-terminal-muted mb-3">
                    Override global LLM defaults for this project. Choose &quot;Inherit global&quot; to use the workspace default.
                  </p>
                  {SESSION_TYPES.map((sessionType) => {
                    const form = sessionForms[sessionType];
                    const isSaving = sessionSaving.has(sessionType);
                    const isSuccess = sessionSuccess.has(sessionType);
                    const isInherit = form?.provider === 'inherit';

                    return (
                      <div
                        key={sessionType}
                        className="bg-terminal-bg border border-terminal-border rounded-lg p-3"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-terminal-text">
                              {LLM_SESSION_TYPE_LABELS[sessionType]}
                            </span>
                            {form?.hasOverride && (
                              <button
                                onClick={() => clearOverride(sessionType)}
                                disabled={isSaving}
                                className="text-xs text-terminal-muted hover:text-terminal-red transition-colors"
                              >
                                Clear override
                              </button>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              <label className="block text-xs text-terminal-muted mb-1">Provider</label>
                              <select
                                value={form?.provider ?? 'inherit'}
                                onChange={(e) => updateSessionForm(sessionType, 'provider', e.target.value)}
                                className="input-field w-full text-sm"
                                disabled={isSaving}
                              >
                                <option value="inherit">Inherit global</option>
                                {PROVIDERS.map((p) => (
                                  <option key={p} value={p}>
                                    {LLM_PROVIDER_PRESETS[p].label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex-1 min-w-0 w-full sm:w-auto">
                              <label className="block text-xs text-terminal-muted mb-1">Model</label>
                              <input
                                type="text"
                                value={form?.model ?? ''}
                                onChange={(e) => updateSessionForm(sessionType, 'model', e.target.value)}
                                placeholder="default"
                                className="input-field w-full text-sm"
                                disabled={isSaving || isInherit}
                              />
                            </div>
                            {!isInherit && (
                              <button
                                onClick={() => saveSessionOverride(sessionType)}
                                disabled={isSaving}
                                className="btn-primary text-sm flex-shrink-0"
                              >
                                {isSaving ? 'Saving...' : isSuccess ? 'Saved' : 'Save'}
                              </button>
                            )}
                          </div>

                          {isInherit && (
                            <p className="text-xs text-terminal-muted">
                              (inheriting global: {getGlobalConfigLabel(sessionType)})
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
