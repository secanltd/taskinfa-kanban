// JWT-based authentication for API keys
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import { getDb, queryOne, execute } from '../db/client';

// Lazy-load JWT_SECRET with validation (only when actually used)
let _secret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (_secret) return _secret;

  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  _secret = new TextEncoder().encode(process.env.JWT_SECRET);
  return _secret;
}

const secret = getSecret;

export interface ApiKeyPayload {
  keyId: string;
  workspaceId: string;
}

// Generate a new API key
export async function generateApiKey(
  workspaceId: string,
  name: string,
  userId?: string,
  expiresInDays?: number
): Promise<{ key: string; id: string }> {
  const db = getDb();
  const keyId = nanoid();
  const apiKey = `tk_${nanoid(32)}`;

  // Create JWT token
  let jwt = new SignJWT({ keyId, workspaceId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d'); // Default 1 year

  if (expiresInDays) {
    jwt = jwt.setExpirationTime(`${expiresInDays}d`);
  }

  const token = await jwt.sign(secret());

  // Hash the key for storage
  const keyHash = await hashKey(apiKey);

  // Build preview: first 8 + last 4 chars of the actual key
  const keyPreview = `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`;

  // Calculate expiration date
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Store in database with user_id
  await execute(
    db,
    `INSERT INTO api_keys (id, workspace_id, user_id, key_hash, key_preview, name, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [keyId, workspaceId, userId || null, keyHash, keyPreview, name, expiresAt]
  );

  return { key: apiKey, id: keyId };
}

// Verify and decode API key
export async function verifyApiKey(apiKey: string): Promise<ApiKeyPayload | null> {
  try {
    const db = getDb();
    const keyHash = await hashKey(apiKey);

    // Find key in database, checking is_active flag
    const keyRecord = await queryOne<{
      id: string;
      workspace_id: string;
      expires_at: string | null;
      is_active: number;
    }>(db, 'SELECT id, workspace_id, expires_at, is_active FROM api_keys WHERE key_hash = ?', [keyHash]);

    if (!keyRecord) {
      return null;
    }

    // Check if key is active (not revoked)
    if (!keyRecord.is_active) {
      return null;
    }

    // Check expiration
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return null;
    }

    // Update last_used_at
    await execute(db, 'UPDATE api_keys SET last_used_at = datetime("now") WHERE id = ?', [
      keyRecord.id,
    ]);

    return {
      keyId: keyRecord.id,
      workspaceId: keyRecord.workspace_id,
    };
  } catch (error) {
    console.error('API key verification failed:', error);
    return null;
  }
}

// Hash API key using Web Crypto API
async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Middleware to protect API routes (API key only)
export async function authenticateRequest(request: Request): Promise<ApiKeyPayload | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const apiKey = authHeader.substring(7);
  return await verifyApiKey(apiKey);
}

// Unified authentication: supports both session cookies (web UI) and API keys (workers)
export async function authenticateRequestUnified(request: Request): Promise<{ userId?: string; workspaceId: string } | null> {
  // First, try session cookie authentication (for web UI)
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => {
        const [key, ...values] = c.split('=');
        return [key, values.join('=')];
      })
    );

    const sessionToken = cookies['session_token'];
    if (sessionToken) {
      // Import verifySessionToken dynamically to avoid circular dependencies
      const { verifySessionToken } = await import('./session');
      const session = await verifySessionToken(sessionToken);
      if (session) {
        return {
          userId: session.userId,
          workspaceId: session.workspaceId,
        };
      }
    }
  }

  // Fall back to API key authentication (for workers/API clients)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);
    const payload = await verifyApiKey(apiKey);
    if (payload) {
      return {
        workspaceId: payload.workspaceId,
      };
    }
  }

  return null;
}
