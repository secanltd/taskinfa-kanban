'use client';

import { useState, useEffect } from 'react';
import ApiKeyItem from './ApiKeyItem';
import ApiKeyCreateDialog from './ApiKeyCreateDialog';

interface ApiKey {
  id: string;
  name: string;
  key_preview: string;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
}

export default function ApiKeyList() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const fetchKeys = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/keys');

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json() as { keys: ApiKey[] };
      setKeys(data.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleKeyCreated = () => {
    setIsCreateDialogOpen(false);
    fetchKeys();
  };

  const handleKeyDeleted = () => {
    fetchKeys();
  };

  const handleKeyUpdated = () => {
    fetchKeys();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-terminal-text">API Keys</h2>
          <p className="text-sm text-terminal-muted mt-1">
            Manage API keys for bot authentication
          </p>
        </div>
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Generate New Key
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-terminal-red/10 border border-terminal-red/20 rounded-lg">
          <p className="text-sm text-terminal-red">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-terminal-green"></div>
          <p className="text-sm text-terminal-muted mt-2">Loading API keys...</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 bg-terminal-bg rounded-lg border border-terminal-border">
          <div className="text-4xl mb-3">🔑</div>
          <p className="text-terminal-muted">No API keys yet</p>
          <p className="text-sm text-terminal-muted mt-1">
            Generate your first API key to start using the bot
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-terminal-border">
          <table className="min-w-full divide-y divide-terminal-border">
            <thead className="bg-terminal-bg">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider">
                  Key Preview
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-terminal-muted uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-terminal-muted uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-border">
              {keys.map((key) => (
                <ApiKeyItem
                  key={key.id}
                  apiKey={key}
                  onDeleted={handleKeyDeleted}
                  onUpdated={handleKeyUpdated}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isCreateDialogOpen && (
        <ApiKeyCreateDialog
          onClose={() => setIsCreateDialogOpen(false)}
          onCreated={handleKeyCreated}
        />
      )}
    </div>
  );
}
