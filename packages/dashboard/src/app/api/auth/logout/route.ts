import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';
import { createErrorResponse } from '@/lib/utils/errors';


export async function POST(request: NextRequest) {
  try {
    // Clear the session cookie
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    return clearSessionCookie(response);

  } catch (error) {
    return createErrorResponse(error, { operation: 'logout' });
  }
}
