// API Route: /api/llm-config/session
// Upsert or delete an LLM session config for a workspace

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, queryOne, execute } from '@/lib/db/client';
import type { LlmSessionConfig, LlmSessionType, LlmProvider } from '@taskinfa/shared';
import { nanoid } from 'nanoid';
import {
  createErrorResponse,
  authenticationError,
  validationError,
} from '@/lib/utils';

const VALID_SESSION_TYPES: LlmSessionType[] = [
  'task',
  'ai_review',
  'fix_review',
  'testing',
  'fix_test_failure',
  'refinement',
  'message',
];

const VALID_PROVIDERS: LlmProvider[] = [
  'anthropic',
  'ollama',
  'lmstudio',
  'openrouter',
  'litellm',
  'custom',
];

// PATCH /api/llm-config/session - Upsert a session config
export async function PATCH(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const body = await request.json();
    const { task_list_id, session_type, provider, model } = body as {
      task_list_id?: string | null;
      session_type: LlmSessionType;
      provider: LlmProvider;
      model?: string | null;
    };

    if (!session_type || !VALID_SESSION_TYPES.includes(session_type)) {
      throw validationError(
        `Invalid session_type: ${session_type}. Valid types: ${VALID_SESSION_TYPES.join(', ')}`
      );
    }

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      throw validationError(
        `Invalid provider: ${provider}. Valid providers: ${VALID_PROVIDERS.join(', ')}`
      );
    }

    const db = getDb();
    const effectiveTaskListId = task_list_id ?? null;

    // Find existing config — handle NULL task_list_id carefully
    let existing: LlmSessionConfig | null;
    if (effectiveTaskListId === null) {
      existing = await queryOne<LlmSessionConfig>(
        db,
        'SELECT * FROM llm_session_config WHERE workspace_id = ? AND session_type = ? AND task_list_id IS NULL',
        [auth.workspaceId, session_type]
      );
    } else {
      existing = await queryOne<LlmSessionConfig>(
        db,
        'SELECT * FROM llm_session_config WHERE workspace_id = ? AND session_type = ? AND task_list_id = ?',
        [auth.workspaceId, session_type, effectiveTaskListId]
      );
    }

    if (existing) {
      await execute(
        db,
        `UPDATE llm_session_config SET provider = ?, model = ?, updated_at = datetime('now') WHERE id = ?`,
        [provider, model ?? null, existing.id]
      );
    } else {
      const id = `llmsc_${nanoid()}`;

      await execute(
        db,
        `INSERT INTO llm_session_config (id, workspace_id, task_list_id, session_type, provider, model)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, auth.workspaceId, effectiveTaskListId, session_type, provider, model ?? null]
      );
    }

    // Fetch updated config
    let sessionConfig: LlmSessionConfig | null;
    if (effectiveTaskListId === null) {
      sessionConfig = await queryOne<LlmSessionConfig>(
        db,
        'SELECT * FROM llm_session_config WHERE workspace_id = ? AND session_type = ? AND task_list_id IS NULL',
        [auth.workspaceId, session_type]
      );
    } else {
      sessionConfig = await queryOne<LlmSessionConfig>(
        db,
        'SELECT * FROM llm_session_config WHERE workspace_id = ? AND session_type = ? AND task_list_id = ?',
        [auth.workspaceId, session_type, effectiveTaskListId]
      );
    }

    if (!sessionConfig) {
      throw new Error('Failed to retrieve updated session config');
    }

    return NextResponse.json({ session_config: sessionConfig });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'upsert_llm_session_config',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}

// DELETE /api/llm-config/session - Delete a session config
export async function DELETE(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const body = await request.json();
    const { task_list_id, session_type } = body as {
      task_list_id?: string | null;
      session_type: LlmSessionType;
    };

    if (!session_type || !VALID_SESSION_TYPES.includes(session_type)) {
      throw validationError(
        `Invalid session_type: ${session_type}. Valid types: ${VALID_SESSION_TYPES.join(', ')}`
      );
    }

    const db = getDb();
    const effectiveTaskListId = task_list_id ?? null;

    if (effectiveTaskListId === null) {
      await execute(
        db,
        'DELETE FROM llm_session_config WHERE workspace_id = ? AND session_type = ? AND task_list_id IS NULL',
        [auth.workspaceId, session_type]
      );
    } else {
      await execute(
        db,
        'DELETE FROM llm_session_config WHERE workspace_id = ? AND session_type = ? AND task_list_id = ?',
        [auth.workspaceId, session_type, effectiveTaskListId]
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'delete_llm_session_config',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
