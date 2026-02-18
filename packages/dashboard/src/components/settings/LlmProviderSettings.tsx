'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  LlmProvider,
  LlmSessionType,
  LlmProviderRecord,
  LlmSessionConfig,
} from '@taskinfa/shared';
import { LLM_PROVIDER_PRESETS, LLM_SESSION_TYPE_LABELS } from '@taskinfa/shared';

const PROVIDERS: LlmProvider[] = ['anthropic', 'ollama', 'lmstudio', 'openrouter', 'litellm', 'custom'];
const SESSION_TYPES: LlmSessionType[] = ['task', 'ai_review', 'fix_review', 'testing', 'fix_test_failure', 'refinement', 'message'];

interface ProviderFormState {
  base_url: string;
  auth_token: string;
}

interface SessionFormState {
  provider: LlmProvider;
  model: string;
}

export default function LlmProviderSettings() {
  const [providers, setProviders] = useState<LlmProviderRecord[]>([]);
  const [sessionConfigs, setSessionConfigs] = useState<LlmSessionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-provider form state
  const [providerForms, setProviderForms] = useState<Record<string, ProviderFormState>>({});
  const [providerSaving, setProviderSaving] = useState<Set<LlmProvider>>(new Set());
  const [providerSuccess, setProviderSuccess] = useState<Set<LlmProvider>>(new Set());

  // Per-session-type form state
  const [sessionForms, setSessionForms] = useState<Record<string, SessionFormState>>({});
  const [sessionSaving, setSessionSaving] = useState<Set<LlmSessionType>>(new Set());
  const [sessionSuccess, setSessionSuccess] = useState<Set<LlmSessionType>>(new Set());

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/llm-config');
      if (!res.ok) throw new Error('Failed to fetch LLM config');
      const data = await res.json() as { providers: LlmProviderRecord[]; session_configs: LlmSessionConfig[] };
      setProviders(data.providers);
      setSessionConfigs(data.session_configs);

      // Initialize provider forms from saved data
      const pForms: Record<string, ProviderFormState> = {};
      for (const p of PROVIDERS) {
        const saved = data.providers.find((r: LlmProviderRecord) => r.provider === p);
        const preset = LLM_PROVIDER_PRESETS[p];
        pForms[p] = {
          base_url: saved?.base_url ?? preset.default_base_url ?? '',
          auth_token: saved?.auth_token ?? '',
        };
      }
      setProviderForms(pForms);

      // Initialize session forms from saved data (global only, task_list_id === null)
      const sForms: Record<string, SessionFormState> = {};
      for (const st of SESSION_TYPES) {
        const saved = data.session_configs.find(
          (c: LlmSessionConfig) => c.session_type === st && c.task_list_id === null
        );
        sForms[st] = {
          provider: saved?.provider ?? 'anthropic',
          model: saved?.model ?? '',
        };
      }
      setSessionForms(sForms);

      setError(null);
    } catch {
      setError('Failed to load LLM configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  async function saveProvider(provider: LlmProvider) {
    const form = providerForms[provider];
    if (!form) return;

    setProviderSaving((prev) => new Set(prev).add(provider));
    setProviderSuccess((prev) => { const next = new Set(prev); next.delete(provider); return next; });
    setError(null);

    try {
      const res = await fetch('/api/llm-config/providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          base_url: form.base_url || null,
          auth_token: form.auth_token || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save provider');
      const data = await res.json() as { provider: LlmProviderRecord };
      setProviders((prev) => {
        const filtered = prev.filter((p) => p.provider !== provider);
        return [...filtered, data.provider];
      });
      setProviderSuccess((prev) => new Set(prev).add(provider));
      setTimeout(() => {
        setProviderSuccess((prev) => { const next = new Set(prev); next.delete(provider); return next; });
      }, 2000);
    } catch {
      setError(`Failed to save ${LLM_PROVIDER_PRESETS[provider].label} settings`);
    } finally {
      setProviderSaving((prev) => { const next = new Set(prev); next.delete(provider); return next; });
    }
  }

  async function saveSessionConfig(sessionType: LlmSessionType) {
    const form = sessionForms[sessionType];
    if (!form) return;

    setSessionSaving((prev) => new Set(prev).add(sessionType));
    setSessionSuccess((prev) => { const next = new Set(prev); next.delete(sessionType); return next; });
    setError(null);

    try {
      const res = await fetch('/api/llm-config/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_type: sessionType,
          provider: form.provider,
          model: form.model || null,
          task_list_id: null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save session config');
      const data = await res.json() as { session_config: LlmSessionConfig };
      setSessionConfigs((prev) => {
        const filtered = prev.filter(
          (c) => !(c.session_type === sessionType && c.task_list_id === null)
        );
        return [...filtered, data.session_config];
      });
      setSessionSuccess((prev) => new Set(prev).add(sessionType));
      setTimeout(() => {
        setSessionSuccess((prev) => { const next = new Set(prev); next.delete(sessionType); return next; });
      }, 2000);
    } catch {
      setError(`Failed to save ${LLM_SESSION_TYPE_LABELS[sessionType]} config`);
    } finally {
      setSessionSaving((prev) => { const next = new Set(prev); next.delete(sessionType); return next; });
    }
  }

  function updateProviderForm(provider: LlmProvider, field: keyof ProviderFormState, value: string) {
    setProviderForms((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  }

  function updateSessionForm(sessionType: LlmSessionType, field: keyof SessionFormState, value: string) {
    setSessionForms((prev) => ({
      ...prev,
      [sessionType]: { ...prev[sessionType], [field]: value },
    }));
  }

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-terminal-text mb-4">LLM Providers</h2>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-terminal-green"></div>
          <p className="text-sm text-terminal-muted mt-2">Loading LLM config...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-terminal-text mb-1">LLM Providers</h2>
      <p className="text-sm text-terminal-muted mb-4">
        Configure which LLM providers and models the orchestrator uses for each session type.
      </p>

      {error && (
        <div className="bg-terminal-red/10 border border-terminal-red/20 text-terminal-red rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Section A: Provider credentials */}
      <h3 className="text-sm font-semibold text-terminal-muted uppercase tracking-wider mb-3">
        Provider Credentials
      </h3>
      <div className="space-y-3 mb-6">
        {PROVIDERS.map((provider) => {
          const preset = LLM_PROVIDER_PRESETS[provider];
          const form = providerForms[provider];
          const isSaving = providerSaving.has(provider);
          const isSuccess = providerSuccess.has(provider);
          const isAnthropic = provider === 'anthropic';

          return (
            <div
              key={provider}
              className={`bg-terminal-bg border rounded-lg p-4 ${
                isAnthropic ? 'border-terminal-border opacity-60' : 'border-terminal-border'
              }`}
            >
              <div className="mb-2">
                <h4 className="text-sm font-semibold text-terminal-text">{preset.label}</h4>
                <p className="text-xs text-terminal-muted">{preset.description}</p>
              </div>

              {isAnthropic ? (
                <p className="text-xs text-terminal-muted italic">
                  Uses ANTHROPIC_API_KEY from orchestrator environment
                </p>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                  <div className="flex-1 min-w-0 w-full sm:w-auto">
                    <label className="block text-xs text-terminal-muted mb-1">Base URL</label>
                    <input
                      type="text"
                      value={form?.base_url ?? ''}
                      onChange={(e) => updateProviderForm(provider, 'base_url', e.target.value)}
                      placeholder={preset.default_base_url ?? 'https://...'}
                      className="input-field w-full text-sm"
                      disabled={isSaving}
                    />
                  </div>
                  {preset.needs_auth_token && (
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <label className="block text-xs text-terminal-muted mb-1">Auth Token</label>
                      <input
                        type="password"
                        value={form?.auth_token ?? ''}
                        onChange={(e) => updateProviderForm(provider, 'auth_token', e.target.value)}
                        placeholder={preset.default_auth_placeholder ?? 'token'}
                        className="input-field w-full text-sm"
                        disabled={isSaving}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => saveProvider(provider)}
                    disabled={isSaving}
                    className="btn-primary text-sm flex-shrink-0"
                  >
                    {isSaving ? 'Saving...' : isSuccess ? 'Saved' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Section B: Global session type defaults */}
      <h3 className="text-sm font-semibold text-terminal-muted uppercase tracking-wider mb-3">
        Global Session Defaults
      </h3>
      <p className="text-xs text-terminal-muted mb-3">
        Default provider and model for each session type. Projects can override these in their settings.
      </p>
      <div className="space-y-3">
        {SESSION_TYPES.map((sessionType) => {
          const form = sessionForms[sessionType];
          const isSaving = sessionSaving.has(sessionType);
          const isSuccess = sessionSuccess.has(sessionType);

          return (
            <div
              key={sessionType}
              className="bg-terminal-bg border border-terminal-border rounded-lg p-4"
            >
              <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                <div className="min-w-0 flex-shrink-0 sm:w-48">
                  <span className="text-sm font-medium text-terminal-text">
                    {LLM_SESSION_TYPE_LABELS[sessionType]}
                  </span>
                </div>
                <div className="flex-1 min-w-0 w-full sm:w-auto">
                  <label className="block text-xs text-terminal-muted mb-1">Provider</label>
                  <select
                    value={form?.provider ?? 'anthropic'}
                    onChange={(e) => updateSessionForm(sessionType, 'provider', e.target.value)}
                    className="input-field w-full text-sm"
                    disabled={isSaving}
                  >
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
                    disabled={isSaving}
                  />
                </div>
                <button
                  onClick={() => saveSessionConfig(sessionType)}
                  disabled={isSaving}
                  className="btn-primary text-sm flex-shrink-0"
                >
                  {isSaving ? 'Saving...' : isSuccess ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
