import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';


export async function POST(request: NextRequest) {
  try {
    // Clear the session cookie
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    return clearSessionCookie(response);

  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
