'use client';

import { useState, FormEvent } from 'react';
import Modal, { ModalHeader, ModalFooter } from '../Modal';

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

      const data = await response.json() as { error?: string; key?: string };

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create API key');
      }

      setCreatedKey(data.key || '');
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
    <Modal isOpen={true} onClose={onClose} size="md">
      {step === 'form' ? (
        <>
          <ModalHeader onClose={onClose}>
            Generate New API Key
          </ModalHeader>

          <div className="px-6 pt-1 pb-0">
            <p className="text-sm text-terminal-muted">
              Create a new API key for bot authentication
            </p>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {error && (
              <div className="p-3 bg-terminal-red/10 border border-terminal-red/20 rounded-lg">
                <p className="text-sm text-terminal-red">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-terminal-muted mb-2">
                Name <span className="text-terminal-red">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input-field w-full"
                placeholder="e.g., Production Bot"
                autoFocus
              />
              <p className="text-xs text-terminal-muted mt-1">
                Choose a descriptive name to identify this key
              </p>
            </div>

            <div>
              <label
                htmlFor="expiresInDays"
                className="block text-sm font-medium text-terminal-muted mb-2"
              >
                Expiration (optional)
              </label>
              <select
                id="expiresInDays"
                value={formData.expiresInDays}
                onChange={(e) => setFormData({ ...formData, expiresInDays: e.target.value })}
                className="input-field w-full"
              >
                <option value="">Never expires</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
                <option value="180">180 days</option>
                <option value="365">365 days</option>
              </select>
              <p className="text-xs text-terminal-muted mt-1">
                Key will automatically stop working after expiration
              </p>
            </div>
          </form>

          <ModalFooter>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isLoading}
              className="btn-primary"
            >
              {isLoading ? 'Generating...' : 'Generate Key'}
            </button>
          </ModalFooter>
        </>
      ) : (
        <>
          <ModalHeader onClose={onClose}>
            API Key Created
          </ModalHeader>

          <div className="px-6 pt-1 pb-0">
            <p className="text-sm text-terminal-red font-medium">
              Save this key now - you won&apos;t be able to see it again!
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-terminal-muted mb-2">
                Your new API key:
              </label>
              <div className="relative">
                <code className="block w-full px-3 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-sm font-mono text-terminal-green break-all">
                  {createdKey}
                </code>
                <button
                  onClick={handleCopy}
                  className={`absolute top-2 right-2 px-3 py-1 text-xs font-medium rounded transition-colors ${
                    copied
                      ? 'bg-terminal-green text-terminal-bg'
                      : 'bg-terminal-surface text-terminal-text hover:bg-terminal-surface-hover'
                  }`}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="p-3 bg-terminal-amber/10 border border-terminal-amber/20 rounded-lg">
              <p className="text-sm text-terminal-amber">
                <strong>Important:</strong> Store this key in a secure location (like a password
                manager or environment variable). For security reasons, we cannot show it again.
              </p>
            </div>

            <div className="space-y-2 text-sm text-terminal-muted">
              <p className="font-medium text-terminal-text">Next steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Copy the key above</li>
                <li>Add it to your bot&apos;s .env file as TASKINFA_API_KEY</li>
                <li>Use it in the Authorization header: Bearer {'{your_key}'}</li>
              </ol>
            </div>
          </div>

          <ModalFooter>
            <button
              onClick={handleDone}
              className="btn-primary"
            >
              I&apos;ve saved my key
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
