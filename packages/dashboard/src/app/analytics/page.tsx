import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb, query } from '@/lib/db/client';
import { verifySessionToken } from '@/lib/auth/session';
import LogoutButton from '@/components/auth/LogoutButton';
import MobileNav from '@/components/MobileNav';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import type { User } from '@taskinfa/shared';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) {
    redirect('/auth/login');
  }

  const session = await verifySessionToken(sessionToken);
  if (!session) {
    redirect('/auth/login');
  }

  const db = getDb();

  const user = await query<User>(
    db,
    'SELECT id, email, name FROM users WHERE id = ?',
    [session.userId]
  );

  if (!user[0]) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-terminal-bg">
      {/* Header */}
      <header className="bg-terminal-surface border-b border-terminal-border relative">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl">&#x1f4ca;</span>
                <h1 className="text-lg sm:text-xl font-bold text-terminal-text">Analytics</h1>
                <span className="text-xs sm:text-sm text-terminal-muted hidden sm:inline">by Taskinfa</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-terminal-muted">
                {user[0].name || user[0].email}
              </span>
              <div className="h-4 w-px bg-terminal-border" />
              <a href="/dashboard" className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors">
                Board
              </a>
              <a href="/overview" className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors">
                Overview
              </a>
              <a href="/projects" className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors">
                Projects
              </a>
              <a href="/settings" className="text-sm text-terminal-muted hover:text-terminal-text px-3 py-1.5 rounded-lg hover:bg-terminal-bg transition-colors">
                Settings
              </a>
              <LogoutButton />
            </div>
            <MobileNav
              links={[
                { href: '/dashboard', label: 'Board' },
                { href: '/overview', label: 'Overview' },
                { href: '/analytics', label: 'Analytics', active: true },
                { href: '/projects', label: 'Projects' },
                { href: '/settings', label: 'Settings' },
              ]}
              userName={user[0].name || user[0].email}
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <AnalyticsDashboard />
      </main>
    </div>
  );
}
