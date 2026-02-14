import { describe, it, expect, beforeAll } from 'vitest';
import { createSession, verifySessionToken } from '@/lib/auth/session';

// Set JWT_SECRET for tests
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-unit-testing-only-32chars!';
});

describe('createSession', () => {
  it('should create a valid JWT token', async () => {
    const token = await createSession('user_123', 'ws_456');
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('should create different tokens for different users', async () => {
    const token1 = await createSession('user_1', 'ws_1');
    const token2 = await createSession('user_2', 'ws_2');
    expect(token1).not.toBe(token2);
  });
});

describe('verifySessionToken', () => {
  it('should verify a valid token and return payload', async () => {
    const token = await createSession('user_123', 'ws_456');
    const payload = await verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload!.userId).toBe('user_123');
    expect(payload!.workspaceId).toBe('ws_456');
    expect(payload!.type).toBe('user');
  });

  it('should return null for invalid token', async () => {
    const payload = await verifySessionToken('invalid.token.here');
    expect(payload).toBeNull();
  });

  it('should return null for empty token', async () => {
    const payload = await verifySessionToken('');
    expect(payload).toBeNull();
  });

  it('should return null for tampered token', async () => {
    const token = await createSession('user_123', 'ws_456');
    const tampered = token.slice(0, -5) + 'xxxxx';
    const payload = await verifySessionToken(tampered);
    expect(payload).toBeNull();
  });
});
