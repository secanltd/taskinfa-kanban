// API Route: /api/llm-config/providers
// Upsert an LLM provider configuration for a workspace

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, queryOne, execute } from '@/lib/db/client';
import type { LlmProviderRecord, LlmProvider } from '@taskinfa/shared';
import { nanoid } from 'nanoid';
import {
  createErrorResponse,
  authenticationError,
  validationError,
} from '@/lib/utils';

const VALID_PROVIDERS: LlmProvider[] = [
  'anthropic',
  'ollama',
  'lmstudio',
  'openrouter',
  'litellm',
  'custom',
];

// PATCH /api/llm-config/providers - Upsert a provider
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const body = await request.json();
    const { provider, base_url, auth_token } = body as {
      provider: LlmProvider;
      base_url?: string | null;
      auth_token?: string | null;
    };

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      throw validationError(
        `Invalid provider: ${provider}. Valid providers: ${VALID_PROVIDERS.join(', ')}`
      );
    }

    const db = getDb();

    const existing = await queryOne<LlmProviderRecord>(
      db,
      'SELECT * FROM llm_providers WHERE workspace_id = ? AND provider = ?',
      [auth.workspaceId, provider]
    );

    if (existing) {
      const updates: string[] = [];
      const updateParams: (string | null)[] = [];

      if (base_url !== undefined) {
        updates.push('base_url = ?');
        updateParams.push(base_url ?? null);
      }

      if (auth_token !== undefined) {
        updates.push('auth_token = ?');
        updateParams.push(auth_token ?? null);
      }

      updates.push("updated_at = datetime('now')");

      await execute(
        db,
        `UPDATE llm_providers SET ${updates.join(', ')} WHERE workspace_id = ? AND provider = ?`,
        [...updateParams, auth.workspaceId, provider]
      );
    } else {
      const id = `llmp_${nanoid()}`;

      await execute(
        db,
        `INSERT INTO llm_providers (id, workspace_id, provider, base_url, auth_token)
         VALUES (?, ?, ?, ?, ?)`,
        [id, auth.workspaceId, provider, base_url ?? null, auth_token ?? null]
      );
    }

    const providerRecord = await queryOne<LlmProviderRecord>(
      db,
      'SELECT * FROM llm_providers WHERE workspace_id = ? AND provider = ?',
      [auth.workspaceId, provider]
    );

    if (!providerRecord) {
      throw new Error('Failed to retrieve updated provider');
    }

    return NextResponse.json({ provider: providerRecord });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'upsert_llm_provider',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
