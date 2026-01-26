// JWT-based authentication for API keys
import { SignJWT, jwtVerify } from 'jose';
import { nanoid } from 'nanoid';
import { getDb, queryOne, execute } from '../db/client';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const secret = new TextEncoder().encode(JWT_SECRET);

export interface ApiKeyPayload {
  keyId: string;
  workspaceId: string;
}

// Generate a new API key
export async function generateApiKey(
  workspaceId: string,
  name: string,
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

  const token = await jwt.sign(secret);

  // Hash the key for storage
  const keyHash = await hashKey(apiKey);

  // Calculate expiration date
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : null;

  // Store in database
  await execute(
    db,
    `INSERT INTO api_keys (id, workspace_id, key_hash, name, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [keyId, workspaceId, keyHash, name, expiresAt]
  );

  return { key: apiKey, id: keyId };
}

// Verify and decode API key
export async function verifyApiKey(apiKey: string): Promise<ApiKeyPayload | null> {
  try {
    const db = getDb();
    const keyHash = await hashKey(apiKey);

    // Find key in database
    const keyRecord = await queryOne<{
      id: string;
      workspace_id: string;
      expires_at: string | null;
    }>(db, 'SELECT id, workspace_id, expires_at FROM api_keys WHERE key_hash = ?', [keyHash]);

    if (!keyRecord) {
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

// Middleware to protect API routes
export async function authenticateRequest(request: Request): Promise<ApiKeyPayload | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const apiKey = authHeader.substring(7);
  return await verifyApiKey(apiKey);
}
