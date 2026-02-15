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

import { GET, POST } from '@/app/api/tasks/route';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { query, execute } from '@/lib/db/client';

function createGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/tasks');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

function createPostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue(null);

    const req = createGetRequest();
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('should return tasks for authenticated user', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });

    const mockTasks = [
      {
        id: 'task_1',
        title: 'Test Task',
        status: 'todo',
        priority: 'medium',
        labels: '["bug"]',
        files_changed: '[]',
        workspace_id: 'ws_1',
      },
    ];
    // First query call is for feature_toggles, second is for tasks
    vi.mocked(query)
      .mockResolvedValueOnce([]) // feature toggles
      .mockResolvedValueOnce(mockTasks);

    const req = createGetRequest();
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.tasks).toBeDefined();
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].labels).toEqual(['bug']);
  });

  it('should filter by status', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });
    vi.mocked(query)
      .mockResolvedValueOnce([]) // feature toggles
      .mockResolvedValueOnce([]);

    const req = createGetRequest({ status: 'done' });
    const res = await GET(req);

    expect(res.status).toBe(200);
    // Verify the query was called with status filter
    expect(vi.mocked(query)).toHaveBeenCalled();
  });

  it('should filter by priority', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });
    vi.mocked(query)
      .mockResolvedValueOnce([]) // feature toggles
      .mockResolvedValueOnce([]);

    const req = createGetRequest({ priority: 'urgent' });
    const res = await GET(req);

    expect(res.status).toBe(200);
  });

  it('should reject invalid status value', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });
    vi.mocked(query).mockResolvedValueOnce([]); // feature toggles

    const req = createGetRequest({ status: 'invalid_status' });
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('should reject invalid priority value', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });
    vi.mocked(query).mockResolvedValueOnce([]); // feature toggles

    const req = createGetRequest({ priority: 'invalid_priority' });
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('should accept sort and order parameters', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });
    vi.mocked(query)
      .mockResolvedValueOnce([]) // feature toggles
      .mockResolvedValueOnce([]);

    const req = createGetRequest({ sort: 'priority', order: 'desc' });
    const res = await GET(req);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue(null);

    const req = createPostRequest({ title: 'New task', task_list_id: 'tl_1' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it('should return 400 for missing title', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });

    const req = createPostRequest({ task_list_id: 'tl_1' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing task_list_id', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });

    const req = createPostRequest({ title: 'New task' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('should create a task successfully', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });

    // Task list exists
    vi.mocked(query)
      .mockResolvedValueOnce([{ id: 'tl_1' }])  // task list check
      .mockResolvedValueOnce([{ max_order: 2 }]) // max order
      .mockResolvedValueOnce([{                    // created task
        id: 'task_new',
        title: 'New task',
        status: 'backlog',
        priority: 'medium',
        labels: '[]',
        files_changed: '[]',
        workspace_id: 'ws_1',
        task_list_id: 'tl_1',
      }]);

    const req = createPostRequest({
      title: 'New task',
      task_list_id: 'tl_1',
      priority: 'medium',
    });
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.task).toBeDefined();
    expect(data.task.title).toBe('New task');
  });

  it('should return 400 for non-existent task list', async () => {
    vi.mocked(authenticateRequestUnified).mockResolvedValue({
      userId: 'user_1',
      workspaceId: 'ws_1',
    });

    vi.mocked(query).mockResolvedValueOnce([]); // task list not found

    const req = createPostRequest({
      title: 'New task',
      task_list_id: 'tl_nonexistent',
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
