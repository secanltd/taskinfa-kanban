'use client';

import { useState, useEffect, useCallback } from 'react';
import type { FeatureToggle, FeatureKey } from '@taskinfa/shared';
import { DEFAULT_FEATURE_CONFIGS, getStatusColumns } from '@taskinfa/shared';

interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  description: string;
  configFields: ConfigField[];
}

interface ConfigField {
  key: string;
  label: string;
  type: 'checkbox' | 'number';
  description: string;
}

const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    key: 'refinement',
    label: 'Refinement',
    description:
      'Adds a Refinement column between Backlog and To Do. Tasks in Backlog are refined by the orchestrator before moving to To Do.',
    configFields: [
      {
        key: 'auto_advance',
        label: 'Auto-advance',
        type: 'checkbox',
        description: 'Automatically move tasks to To Do after refinement completes',
      },
    ],
  },
  {
    key: 'ai_review',
    label: 'AI Review',
    description:
      'Adds AI Review and Review Rejected columns. Completed tasks are automatically reviewed by AI before moving to Review.',
    configFields: [
      {
        key: 'auto_advance_on_approve',
        label: 'Auto-advance on approve',
        type: 'checkbox',
        description: 'Automatically move tasks to Review when AI approves',
      },
      {
        key: 'max_review_rounds',
        label: 'Max review rounds',
        type: 'number',
        description: 'Maximum number of AI review rounds before auto-approving',
      },
    ],
  },
];

export default function FeatureToggleSettings() {
  const [toggles, setToggles] = useState<FeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingKeys, setUpdatingKeys] = useState<Set<FeatureKey>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const fetchToggles = useCallback(async () => {
    try {
      const res = await fetch('/api/feature-toggles');
      if (!res.ok) throw new Error('Failed to fetch feature toggles');
      const data = await res.json() as { toggles: FeatureToggle[] };
      setToggles(data.toggles);
      setError(null);
    } catch {
      setError('Failed to load feature toggles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchToggles();
  }, [fetchToggles]);

  async function updateToggle(featureKey: FeatureKey, update: { enabled?: boolean; config?: Record<string, unknown> }) {
    setUpdatingKeys((prev) => new Set(prev).add(featureKey));
    setError(null);
    try {
      const res = await fetch(`/api/feature-toggles/${featureKey}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!res.ok) throw new Error('Failed to update toggle');
      const data = await res.json() as { toggle: FeatureToggle };
      setToggles((prev) =>
        prev.map((t) => (t.feature_key === featureKey ? data.toggle : t))
      );
    } catch {
      setError(`Failed to update ${featureKey}`);
    } finally {
      setUpdatingKeys((prev) => {
        const next = new Set(prev);
        next.delete(featureKey);
        return next;
      });
    }
  }

  function getToggle(key: FeatureKey): FeatureToggle {
    const found = toggles.find((t) => t.feature_key === key);
    if (found) return found;
    return {
      id: '',
      workspace_id: '',
      feature_key: key,
      enabled: false,
      config: DEFAULT_FEATURE_CONFIGS[key],
      created_at: '',
      updated_at: '',
    };
  }

  // Build column preview
  const enabledFeatures: Record<FeatureKey, boolean> = {
    refinement: getToggle('refinement').enabled,
    ai_review: getToggle('ai_review').enabled,
  };
  const columns = getStatusColumns(enabledFeatures);

  if (loading) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-terminal-text mb-4">Feature Toggles</h2>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-terminal-green"></div>
          <p className="text-sm text-terminal-muted mt-2">Loading toggles...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-terminal-text mb-1">Feature Toggles</h2>
      <p className="text-sm text-terminal-muted mb-4">
        Enable optional workflow stages on your kanban board.
      </p>

      {error && (
        <div className="bg-terminal-red/10 border border-terminal-red/20 text-terminal-red rounded-lg px-4 py-3 text-sm mb-4">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {FEATURE_DEFINITIONS.map((def) => {
          const toggle = getToggle(def.key);
          const isUpdating = updatingKeys.has(def.key);

          return (
            <div
              key={def.key}
              className={`bg-terminal-bg border rounded-lg p-4 transition-colors ${
                toggle.enabled ? 'border-terminal-green/30' : 'border-terminal-border'
              }`}
            >
              {/* Toggle header */}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-terminal-text">{def.label}</h3>
                  <p className="text-xs text-terminal-muted mt-0.5">{def.description}</p>
                </div>
                <button
                  onClick={() => updateToggle(def.key, { enabled: !toggle.enabled })}
                  disabled={isUpdating}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-terminal-green focus:ring-offset-2 focus:ring-offset-terminal-surface disabled:opacity-50 ${
                    toggle.enabled ? 'bg-terminal-green' : 'bg-terminal-border'
                  }`}
                  role="switch"
                  aria-checked={toggle.enabled}
                  aria-label={`Toggle ${def.label}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                      toggle.enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Config options (shown when enabled) */}
              {toggle.enabled && def.configFields.length > 0 && (
                <div className="mt-3 pt-3 border-t border-terminal-border space-y-3">
                  {def.configFields.map((field) => {
                    const configValue = (toggle.config as Record<string, unknown>)[field.key];

                    if (field.type === 'checkbox') {
                      return (
                        <label
                          key={field.key}
                          className="flex items-start gap-2.5 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(configValue)}
                            onChange={(e) =>
                              updateToggle(def.key, {
                                config: { ...toggle.config, [field.key]: e.target.checked },
                              })
                            }
                            disabled={isUpdating}
                            className="mt-0.5 h-4 w-4 rounded border-terminal-border bg-terminal-bg text-terminal-green focus:ring-terminal-green focus:ring-offset-terminal-surface disabled:opacity-50"
                          />
                          <div>
                            <span className="text-sm text-terminal-text group-hover:text-terminal-green transition-colors">
                              {field.label}
                            </span>
                            <p className="text-xs text-terminal-muted">{field.description}</p>
                          </div>
                        </label>
                      );
                    }

                    if (field.type === 'number') {
                      return (
                        <div key={field.key}>
                          <label className="block text-sm text-terminal-text mb-1">
                            {field.label}
                          </label>
                          <p className="text-xs text-terminal-muted mb-1.5">{field.description}</p>
                          <input
                            type="number"
                            value={Number(configValue) || 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val) && val >= 1 && val <= 10) {
                                updateToggle(def.key, {
                                  config: { ...toggle.config, [field.key]: val },
                                });
                              }
                            }}
                            min={1}
                            max={10}
                            disabled={isUpdating}
                            className="input-field w-24"
                          />
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Board column preview */}
      <div className="mt-4 pt-4 border-t border-terminal-border">
        <h3 className="text-sm font-medium text-terminal-muted mb-2">Board column preview</h3>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((col) => (
            <span
              key={col.status}
              className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
                col.featureKey
                  ? 'bg-terminal-green/10 text-terminal-green border border-terminal-green/20'
                  : 'bg-terminal-surface text-terminal-muted border border-terminal-border'
              }`}
            >
              <span>{col.icon}</span>
              <span>{col.label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
