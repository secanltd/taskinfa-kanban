import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock the Cloudflare context before importing route handlers
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(),
}));

// Mock db/client
vi.mock('@/lib/db/client', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ success: true, results: [] }),
    }),
    batch: vi.fn(),
    exec: vi.fn(),
  };

  return {
    getDb: vi.fn().mockReturnValue(mockDb),
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    execute: vi.fn().mockResolvedValue({ success: true }),
  };
});

// Mock auth modules
vi.mock('@/lib/auth/password', () => ({
  hashPassword: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
  verifyPassword: vi.fn().mockResolvedValue(false),
  validatePassword: vi.fn().mockReturnValue({ valid: true, errors: [] }),
}));

vi.mock('@/lib/auth/session', () => ({
  createSession: vi.fn().mockResolvedValue('mock-session-token'),
  setSessionCookie: vi.fn((response) => response),
}));

vi.mock('@/lib/auth/jwt', () => ({
  authenticateRequestUnified: vi.fn().mockResolvedValue(null),
}));

import { POST as loginPost } from '@/app/api/auth/login/route';
import { POST as signupPost } from '@/app/api/auth/signup/route';
import { queryOne } from '@/lib/db/client';
import { verifyPassword } from '@/lib/auth/password';

function createRequest(body: Record<string, unknown>, url = 'http://localhost:3000/api/auth/login'): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-for-testing-32chars!!';
  });

  it('should return 401 for missing credentials', async () => {
    const req = createRequest({});
    const res = await loginPost(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it('should return 401 for missing password', async () => {
    const req = createRequest({ email: 'test@example.com' });
    const res = await loginPost(req);

    expect(res.status).toBe(401);
  });

  it('should return 401 for non-existent user', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce(null);

    const req = createRequest({ email: 'nonexistent@example.com', password: 'Test1234' });
    const res = await loginPost(req);

    expect(res.status).toBe(401);
  });

  it('should return 401 for wrong password', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
      password_hash: '$2b$12$hash',
      name: 'Test',
      workspace_id: 'ws_1',
      is_verified: true,
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      last_login_at: null,
    });
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);

    const req = createRequest({ email: 'test@example.com', password: 'WrongPass1' });
    const res = await loginPost(req);

    expect(res.status).toBe(401);
  });

  it('should return 403 for disabled account', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({
      id: 'user_1',
      email: 'test@example.com',
      password_hash: '$2b$12$hash',
      name: 'Test',
      workspace_id: 'ws_1',
      is_verified: true,
      is_active: false, // disabled
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      last_login_at: null,
    });

    const req = createRequest({ email: 'test@example.com', password: 'Test1234!' });
    const res = await loginPost(req);

    expect(res.status).toBe(403);
  });

  it('should return 200 for valid credentials', async () => {
    const mockUser = {
      id: 'user_1',
      email: 'test@example.com',
      password_hash: '$2b$12$hash',
      name: 'Test User',
      workspace_id: 'ws_1',
      is_verified: 1,
      is_active: 1,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
      last_login_at: null,
    };
    const mockWorkspace = {
      id: 'ws_1',
      name: 'Test Workspace',
      description: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };

    vi.mocked(queryOne)
      .mockResolvedValueOnce(mockUser)    // Find user
      .mockResolvedValueOnce(mockWorkspace); // Find workspace
    vi.mocked(verifyPassword).mockResolvedValueOnce(true);

    const req = createRequest({ email: 'test@example.com', password: 'Test1234!' });
    const res = await loginPost(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('test@example.com');
    expect(data.workspace).toBeDefined();
    // password_hash should not be in response
    expect(data.user.password_hash).toBeUndefined();
  });
});

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret-key-for-testing-32chars!!';
  });

  it('should return 400 for missing email', async () => {
    const req = createRequest({ password: 'Test1234!' }, 'http://localhost:3000/api/auth/signup');
    const res = await signupPost(req);

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing password', async () => {
    const req = createRequest({ email: 'test@example.com' }, 'http://localhost:3000/api/auth/signup');
    const res = await signupPost(req);

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid email format', async () => {
    const req = createRequest(
      { email: 'notanemail', password: 'Test1234!' },
      'http://localhost:3000/api/auth/signup'
    );
    const res = await signupPost(req);

    expect(res.status).toBe(400);
  });

  it('should return 400 for weak password', async () => {
    const { validatePassword } = await import('@/lib/auth/password');
    vi.mocked(validatePassword).mockReturnValueOnce({ valid: false, errors: ['Too short'] });

    const req = createRequest(
      { email: 'test@example.com', password: 'weak' },
      'http://localhost:3000/api/auth/signup'
    );
    const res = await signupPost(req);

    expect(res.status).toBe(400);
  });

  it('should return 409 for duplicate email', async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 'existing_user' });

    const req = createRequest(
      { email: 'existing@example.com', password: 'Test1234!' },
      'http://localhost:3000/api/auth/signup'
    );
    const res = await signupPost(req);

    expect(res.status).toBe(409);
  });

  it('should return 201 for successful signup', async () => {
    vi.mocked(queryOne)
      .mockResolvedValueOnce(null) // No existing user
      .mockResolvedValueOnce({     // Created user
        id: 'user_new',
        email: 'new@example.com',
        password_hash: '$2b$12$hash',
        name: 'New User',
        workspace_id: 'ws_new',
        is_verified: 0,
        is_active: 1,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        last_login_at: null,
      })
      .mockResolvedValueOnce({     // Created workspace
        id: 'ws_new',
        name: "New User's Workspace",
        description: 'Personal workspace',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      });

    const req = createRequest(
      { email: 'new@example.com', password: 'Test1234!', name: 'New User' },
      'http://localhost:3000/api/auth/signup'
    );
    const res = await signupPost(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.user).toBeDefined();
    expect(data.workspace).toBeDefined();
  });
});
