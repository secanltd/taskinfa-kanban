// API Route: /api/tasks/stream
// SSE endpoint removed — clients now poll /api/tasks and /api/workers directly.
// This route returns 410 Gone to prevent lingering SSE connections.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      error: 'Gone',
      message: 'SSE stream removed. Use /api/tasks and /api/workers for polling.',
    },
    { status: 410 }
  );
}
