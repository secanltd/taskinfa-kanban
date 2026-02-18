// API Route: /api/llm-config
// Get all LLM providers and session configs for a workspace

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query } from '@/lib/db/client';
import type { LlmProviderRecord, LlmSessionConfig, GetLlmConfigResponse } from '@taskinfa/shared';
import { createErrorResponse, authenticationError } from '@/lib/utils';

// GET /api/llm-config - List all providers and session configs
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const db = getDb();

    const providers = await query<LlmProviderRecord>(
      db,
      'SELECT * FROM llm_providers WHERE workspace_id = ? ORDER BY provider ASC',
      [auth.workspaceId]
    );

    const session_configs = await query<LlmSessionConfig>(
      db,
      'SELECT * FROM llm_session_config WHERE workspace_id = ? ORDER BY session_type ASC',
      [auth.workspaceId]
    );

    const response: GetLlmConfigResponse = { providers, session_configs };
    return NextResponse.json(response);
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'get_llm_config',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
