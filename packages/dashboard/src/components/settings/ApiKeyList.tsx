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

      const data = await response.json();
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
          <h2 className="text-xl font-semibold text-gray-900">API Keys</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage API keys for bot authentication
          </p>
        </div>
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Generate New Key
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 mt-2">Loading API keys...</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-gray-600">No API keys yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Generate your first API key to start using the bot
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key Preview
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
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
