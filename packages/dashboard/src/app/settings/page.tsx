import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, queryOne } from '@/lib/db/client';
import { verifySessionToken } from '@/lib/auth/session';
import LogoutButton from '@/components/auth/LogoutButton';
import ApiKeyList from '@/components/settings/ApiKeyList';
import FeatureToggleSettings from '@/components/settings/FeatureToggleSettings';
import type { User, Workspace } from '@taskinfa/shared';

// Force dynamic rendering since we need access to D1 database and auth
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  // Check authentication
  if (!sessionToken) {
    redirect('/auth/login');
  }

  const session = await verifySessionToken(sessionToken);
  if (!session) {
    redirect('/auth/login');
  }

  const db = getDb();

  // Fetch user info
  const user = await queryOne<User>(
    db,
    'SELECT id, email, name, created_at, last_login_at FROM users WHERE id = ?',
    [session.userId]
  );

  // Fetch workspace info
  const workspace = await queryOne<Workspace>(
    db,
    'SELECT id, name, description, created_at FROM workspaces WHERE id = ?',
    [session.workspaceId]
  );

  if (!user || !workspace) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-terminal-bg">
      {/* Header */}
      <header className="bg-terminal-surface border-b border-terminal-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0">
              <a href="/dashboard" className="flex items-center gap-1.5 sm:gap-2 text-terminal-muted hover:text-terminal-text transition-colors flex-shrink-0 touch-manipulation p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="text-sm hidden sm:inline">Dashboard</span>
              </a>
              <div className="h-4 w-px bg-terminal-border hidden sm:block" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-terminal-text">Settings</h1>
                <p className="text-terminal-muted text-xs sm:text-sm hidden sm:block">
                  Manage your account and API keys
                </p>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-4 sm:space-y-6">
          {/* Profile Section */}
          <div className="card p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-terminal-text mb-4">Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-terminal-muted">Name</label>
                <p className="text-terminal-text mt-1">{user.name || 'Not set'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-terminal-muted">Email</label>
                <p className="text-terminal-text mt-1">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-terminal-muted">Account created</label>
                <p className="text-terminal-text mt-1">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {user.last_login_at && (
                <div>
                  <label className="text-sm font-medium text-terminal-muted">Last login</label>
                  <p className="text-terminal-text mt-1">
                    {new Date(user.last_login_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Workspace Section */}
          <div className="card p-4 sm:p-6">
            <h2 className="text-lg font-semibold text-terminal-text mb-4">Workspace</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-terminal-muted">Workspace name</label>
                <p className="text-terminal-text mt-1">{workspace.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-terminal-muted">Workspace ID</label>
                <p className="text-terminal-text mt-1 font-mono text-xs sm:text-sm bg-terminal-bg px-2 py-1 rounded inline-block break-all">
                  {workspace.id}
                </p>
              </div>
              {workspace.description && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-terminal-muted">Description</label>
                  <p className="text-terminal-text mt-1">{workspace.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Feature Toggles Section */}
          <div className="card p-4 sm:p-6">
            <FeatureToggleSettings />
          </div>

          {/* API Keys Section */}
          <div className="card p-4 sm:p-6">
            <ApiKeyList />
          </div>
        </div>
      </main>

      <footer className="bg-terminal-surface border-t border-terminal-border mt-auto">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 text-center">
          <span className="text-terminal-muted text-xs sm:text-sm">
            Developed by <span className="font-semibold text-terminal-text">SECAN</span> • Open Source MIT License
          </span>
        </div>
      </footer>
    </div>
  );
}
