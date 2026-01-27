import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '@/lib/auth/session';

// Force dynamic rendering since we need to check auth
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  // Check if user is authenticated
  if (sessionToken) {
    const session = await verifySessionToken(sessionToken);
    if (session) {
      // User is logged in, redirect to dashboard
      redirect('/dashboard');
    }
  }

  // User is not authenticated, redirect to login
  redirect('/auth/login');
}
