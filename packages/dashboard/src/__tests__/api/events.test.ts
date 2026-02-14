import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Cloudflare context
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

// Mock db/client
vi.mock('@/lib/db/client', () => ({
  getDb: vi.fn().mockReturnValue({}),
  query: vi.fn().mockResolvedValue([]),
  queryOne: vi.fn().mockResolvedValue(null),
  execute: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock auth
vi.mock('@/lib/auth/jwt', () => ({
  authenticateRequestUnified: vi.fn().mockResolvedValue(null),
}));

import { POST, GET } from '@/app/api/events/route';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { query, queryOne, execute } from '@/lib/db/client';

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function createGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/events');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

describe('POST /api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue(null);

    const req = createPostRequest({ event_type: 'task_completed' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('should return 400 for missing event_type', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      workspaceId: 'ws_1',
    });

    const req = createPostRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid event_type', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      workspaceId: 'ws_1',
    });

    const req = createPostRequest({ event_type: 'invalid_type' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('should create an event successfully', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      workspaceId: 'ws_1',
    });
    // No notification config found
    vi.mocked(queryOne).mockResolvedValue(null);

    const req = createPostRequest({
      event_type: 'task_progress',
      session_id: 'sess_1',
      task_id: 'task_1',
      message: 'Working on feature',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.event).toBeDefined();
    expect(data.event.event_type).toBe('task_progress');
    expect(data.event.message).toBe('Working on feature');
  });

  it('should update session status for stuck event', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      workspaceId: 'ws_1',
    });
    vi.mocked(queryOne).mockResolvedValue(null);

    const req = createPostRequest({
      event_type: 'stuck',
      session_id: 'sess_1',
      message: 'Blocked on issue',
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    // Verify session was updated to stuck
    expect(vi.mocked(execute)).toHaveBeenCalled();
  });

  it('should accept all valid event types', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      workspaceId: 'ws_1',
    });
    vi.mocked(queryOne).mockResolvedValue(null);

    const validTypes = [
      'task_claimed', 'task_progress', 'task_completed',
      'stuck', 'needs_input', 'error',
      'session_start', 'session_end', 'notification',
    ];

    for (const eventType of validTypes) {
      vi.clearAllMocks();
      vi.mocked(authenticateRequestUnified).mockResolvedValue({
        workspaceId: 'ws_1',
      });
      vi.mocked(queryOne).mockResolvedValue(null);

      const req = createPostRequest({ event_type: eventType });
      const res = await POST(req);

      expect(res.status).toBe(201);
    }
  });
});

describe('GET /api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue(null);

    const req = createGetRequest();
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('should return events for authenticated user', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      workspaceId: 'ws_1',
    });

    const mockEvents = [
      {
        id: 'evt_1',
        session_id: 'sess_1',
        task_id: 'task_1',
        event_type: 'task_progress',
        message: 'Working...',
        metadata: '{}',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    vi.mocked(query).mockResolvedValueOnce(mockEvents);

    const req = createGetRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.events).toBeDefined();
    expect(data.events).toHaveLength(1);
  });

  it('should filter by session_id', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      workspaceId: 'ws_1',
    });
    vi.mocked(query).mockResolvedValueOnce([]);

    const req = createGetRequest({ session_id: 'sess_1' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(vi.mocked(query)).toHaveBeenCalled();
  });
});
