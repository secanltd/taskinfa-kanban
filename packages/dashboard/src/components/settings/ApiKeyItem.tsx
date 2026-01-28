'use client';

import { useState } from 'react';

interface ApiKeyItemProps {
  apiKey: {
    id: string;
    name: string;
    key_preview: string;
    last_used_at: string | null;
    created_at: string;
    expires_at: string | null;
    is_active: boolean;
  };
  onDeleted: () => void;
  onUpdated: () => void;
}

export default function ApiKeyItem({ apiKey, onDeleted, onUpdated }: ApiKeyItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(apiKey.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const handleRename = async () => {
    if (editedName.trim() === apiKey.name) {
      setIsEditing(false);
      return;
    }

    if (!editedName.trim()) {
      setError('Name cannot be empty');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/keys/${apiKey.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: editedName.trim() }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || 'Failed to rename key');
      }

      setIsEditing(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/keys/${apiKey.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error || 'Failed to revoke key');
      }

      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <>
      <tr className={`${isDeleting ? 'opacity-50' : ''} hover:bg-terminal-surface-hover transition-colors`}>
        <td className="px-4 py-4 whitespace-nowrap">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="input-field text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename();
                  if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditedName(apiKey.name);
                  }
                }}
              />
              <button
                onClick={handleRename}
                disabled={isSaving}
                className="text-xs text-terminal-green hover:text-green-400 font-medium transition-colors"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditedName(apiKey.name);
                  setError(null);
                }}
                className="text-xs text-terminal-muted hover:text-terminal-text transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="text-sm font-medium text-terminal-text">{apiKey.name}</div>
          )}
          {error && <p className="text-xs text-terminal-red mt-1">{error}</p>}
        </td>
        <td className="px-4 py-4 whitespace-nowrap">
          <code className="text-sm text-terminal-muted bg-terminal-bg px-2 py-1 rounded font-mono">
            {apiKey.key_preview}
          </code>
        </td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-terminal-muted">
          {formatDate(apiKey.last_used_at)}
        </td>
        <td className="px-4 py-4 whitespace-nowrap text-sm text-terminal-muted">
          {formatDate(apiKey.created_at)}
        </td>
        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div className="flex justify-end gap-3">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-terminal-blue hover:text-blue-400 transition-colors"
              >
                Rename
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isDeleting}
              className="text-terminal-muted hover:text-terminal-red transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Revoking...' : 'Revoke'}
            </button>
          </div>
        </td>
      </tr>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <tr>
          <td colSpan={5} className="px-4 py-4">
            <div className="bg-terminal-red/10 border border-terminal-red/20 rounded-lg p-4">
              <p className="text-sm text-terminal-red font-medium mb-2">
                Revoke API key &quot;{apiKey.name}&quot;?
              </p>
              <p className="text-sm text-terminal-muted mb-4">
                This action cannot be undone. The key will stop working immediately and any bots
                using it will lose access.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn-danger"
                >
                  {isDeleting ? 'Revoking...' : 'Yes, revoke key'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
