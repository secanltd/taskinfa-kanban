'use client';

import { useState, FormEvent } from 'react';

interface ApiKeyCreateDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function ApiKeyCreateDialog({ onClose, onCreated }: ApiKeyCreateDialogProps) {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [formData, setFormData] = useState({
    name: '',
    expiresInDays: '',
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Please enter a name for the API key');
      return;
    }

    setIsLoading(true);

    try {
      const body: { name: string; expiresInDays?: number } = {
        name: formData.name.trim(),
      };

      if (formData.expiresInDays) {
        const days = parseInt(formData.expiresInDays, 10);
        if (days > 0 && days <= 365) {
          body.expiresInDays = days;
        }
      }

      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create API key');
      }

      setCreatedKey(data.key);
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;

    try {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDone = () => {
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {step === 'form' ? (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Generate New API Key</h3>
              <p className="text-sm text-gray-600 mt-1">
                Create a new API key for bot authentication
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Production Bot"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Choose a descriptive name to identify this key
                </p>
              </div>

              <div>
                <label
                  htmlFor="expiresInDays"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Expiration (optional)
                </label>
                <select
                  id="expiresInDays"
                  value={formData.expiresInDays}
                  onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Never expires</option>
                  <option value="30">30 days</option>
                  <option value="60">60 days</option>
                  <option value="90">90 days</option>
                  <option value="180">180 days</option>
                  <option value="365">365 days</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Key will automatically stop working after expiration
                </p>
              </div>
            </form>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3 rounded-b-lg">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Generating...' : 'Generate Key'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">API Key Created</h3>
              <p className="text-sm text-red-600 mt-1 font-medium">
                Save this key now - you won't be able to see it again!
              </p>
            </div>

            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your new API key:
                </label>
                <div className="relative">
                  <code className="block w-full px-3 py-3 bg-gray-50 border border-gray-300 rounded-md text-sm font-mono text-gray-900 break-all">
                    {createdKey}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="absolute top-2 right-2 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> Store this key in a secure location (like a password
                  manager or environment variable). For security reasons, we cannot show it again.
                </p>
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <p className="font-medium text-gray-900">Next steps:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Copy the key above</li>
                  <li>Add it to your bot's .env file as TASKINFA_API_KEY</li>
                  <li>Use it in the Authorization header: Bearer {'{your_key}'}</li>
                </ol>
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end rounded-b-lg">
              <button
                onClick={handleDone}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                I've saved my key
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
