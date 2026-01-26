import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, queryOne } from '@/lib/db/client';
import { verifySessionToken } from '@/lib/auth/session';
import LogoutButton from '@/components/auth/LogoutButton';
import ApiKeyList from '@/components/settings/ApiKeyList';
import type { User, Workspace } from '@taskinfa/shared';

// Force dynamic rendering since we need access to D1 database and auth
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

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
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            <p className="text-gray-600 text-sm mt-1">
              Manage your account and API keys
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/dashboard"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Dashboard
            </a>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Profile Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Name</label>
                <p className="text-gray-900">{user.name || 'Not set'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <p className="text-gray-900">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Account created</label>
                <p className="text-gray-900">
                  {new Date(user.created_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              {user.last_login_at && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Last login</label>
                  <p className="text-gray-900">
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
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Workspace</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Workspace name</label>
                <p className="text-gray-900">{workspace.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Workspace ID</label>
                <p className="text-gray-900 font-mono text-sm">{workspace.id}</p>
              </div>
              {workspace.description && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <p className="text-gray-900">{workspace.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* API Keys Section */}
          <div className="bg-white shadow rounded-lg p-6">
            <ApiKeyList />
          </div>
        </div>
      </main>

      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-gray-500 text-sm">
          Developed by <span className="font-semibold">SECAN</span> • Open Source MIT License
        </div>
      </footer>
    </div>
  );
}
