import { NextRequest, NextResponse } from 'next/server';
import { getDb, query } from '@/lib/db/client';
import { requireAuth } from '@/lib/auth/middleware';
import { generateApiKey } from '@/lib/auth/jwt';
import { createErrorResponse } from '@/lib/utils/errors';
import { checkRateLimit, createRateLimitResponse, sessionRateLimitKey, RATE_LIMITS } from '@/lib/middleware/rateLimit';
import { applyRateLimitHeaders } from '@/lib/middleware/apiRateLimit';
import type { CreateApiKeyRequest, CreateApiKeyResponse, ListApiKeysResponse, ApiKey } from '@taskinfa/shared';


// GET /api/keys - List user's API keys
export async function GET(request: NextRequest) {
  try {
    // Verify session authentication
    const session = await requireAuth(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const db = getDb();

    // Fetch user's active API keys
    const keys = await query<ApiKey & { key_preview?: string }>(
      db,
      `SELECT id, name, key_hash, key_preview, last_used_at, created_at, expires_at, is_active
       FROM api_keys
       WHERE user_id = ? AND is_active = 1
       ORDER BY created_at DESC`,
      [session.userId]
    );

    // Format response with key previews
    const response: ListApiKeysResponse = {
      keys: keys.map((key) => ({
        id: key.id,
        name: key.name,
        key_preview: key.key_preview || `tk_${key.key_hash.substring(0, 6)}...`,
        last_used_at: key.last_used_at,
        created_at: key.created_at,
        expires_at: key.expires_at,
        is_active: Boolean(key.is_active),
      })),
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    return createErrorResponse(error, { operation: 'list_api_keys' });
  }
}

// POST /api/keys - Generate new API key
export async function POST(request: NextRequest) {
  try {
    // Verify session authentication
    const session = await requireAuth(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // D1-based rate limiting (10/hour per user)
    const db = getDb();
    const rlKey = sessionRateLimitKey(session.userId, 'api-key-create');
    const rl = await checkRateLimit(db, rlKey, RATE_LIMITS.API_KEY_CREATE);
    if (!rl.allowed) {
      return createRateLimitResponse(rl);
    }

    const body: CreateApiKeyRequest = await request.json();
    const { name, expiresInDays } = body;

    // Validate name
    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'API key name is required' },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'API key name must be less than 100 characters' },
        { status: 400 }
      );
    }

    // Validate expiresInDays if provided
    if (expiresInDays !== undefined) {
      if (expiresInDays < 1 || expiresInDays > 365) {
        return NextResponse.json(
          { error: 'Expiration must be between 1 and 365 days' },
          { status: 400 }
        );
      }
    }

    // Generate API key with user_id
    const { key, id } = await generateApiKey(
      session.workspaceId,
      name.trim(),
      session.userId,
      expiresInDays
    );

    // Fetch created key details
    const keyRecord = await query<ApiKey>(
      db,
      'SELECT created_at, expires_at FROM api_keys WHERE id = ?',
      [id]
    );

    if (keyRecord.length === 0) {
      return NextResponse.json(
        { error: 'Failed to retrieve created key' },
        { status: 500 }
      );
    }

    const response: CreateApiKeyResponse = {
      key, // Plaintext key - ONLY shown once
      id,
      name: name.trim(),
      created_at: keyRecord[0].created_at,
      expires_at: keyRecord[0].expires_at,
      warning: "Save this key now. You won't be able to see it again.",
    };

    const nextResponse = NextResponse.json(response, { status: 201 });
    return applyRateLimitHeaders(nextResponse, rl);

  } catch (error) {
    return createErrorResponse(error, { operation: 'create_api_key' });
  }
}
