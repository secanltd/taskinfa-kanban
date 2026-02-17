// API Route: /api/feature-toggles/[feature_key]
// Enable/disable a feature toggle and update its config

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, queryOne, execute } from '@/lib/db/client';
import type { FeatureToggle, FeatureKey, UpdateFeatureToggleRequest } from '@taskinfa/shared';
import { DEFAULT_FEATURE_CONFIGS } from '@taskinfa/shared';
import { nanoid } from 'nanoid';
import {
  safeJsonParseObject,
  createErrorResponse,
  authenticationError,
  validationError,
} from '@/lib/utils';

const VALID_FEATURE_KEYS: FeatureKey[] = ['refinement', 'ai_review', 'local_testing'];

// PATCH /api/feature-toggles/[feature_key] - Update toggle
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ feature_key: string }> }
) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const { feature_key } = await params;

    if (!VALID_FEATURE_KEYS.includes(feature_key as FeatureKey)) {
      throw validationError(`Invalid feature key: ${feature_key}. Valid keys: ${VALID_FEATURE_KEYS.join(', ')}`);
    }

    const body: UpdateFeatureToggleRequest = await request.json();
    const { enabled, config } = body;

    if (enabled === undefined && config === undefined) {
      throw validationError('At least one of "enabled" or "config" must be provided');
    }

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      throw validationError('"enabled" must be a boolean');
    }

    if (config !== undefined && (typeof config !== 'object' || config === null || Array.isArray(config))) {
      throw validationError('"config" must be a JSON object');
    }

    const db = getDb();

    // Check if toggle already exists
    const existing = await queryOne<FeatureToggle>(
      db,
      'SELECT * FROM feature_toggles WHERE workspace_id = ? AND feature_key = ?',
      [auth.workspaceId, feature_key]
    );

    if (existing) {
      // Update existing toggle
      const updates: string[] = [];
      const updateParams: (string | number)[] = [];

      if (enabled !== undefined) {
        updates.push('enabled = ?');
        updateParams.push(enabled ? 1 : 0);
      }

      if (config !== undefined) {
        updates.push('config = ?');
        updateParams.push(JSON.stringify(config));
      }

      updates.push("updated_at = datetime('now')");

      await execute(
        db,
        `UPDATE feature_toggles SET ${updates.join(', ')} WHERE workspace_id = ? AND feature_key = ?`,
        [...updateParams, auth.workspaceId, feature_key]
      );
    } else {
      // Insert new toggle with defaults
      const defaultConfig = DEFAULT_FEATURE_CONFIGS[feature_key as FeatureKey];
      const toggleId = `ft_${nanoid()}`;

      await execute(
        db,
        `INSERT INTO feature_toggles (id, workspace_id, feature_key, enabled, config)
         VALUES (?, ?, ?, ?, ?)`,
        [
          toggleId,
          auth.workspaceId,
          feature_key,
          (enabled ?? false) ? 1 : 0,
          JSON.stringify(config ?? defaultConfig),
        ]
      );
    }

    // Fetch updated toggle
    const toggle = await queryOne<FeatureToggle>(
      db,
      'SELECT * FROM feature_toggles WHERE workspace_id = ? AND feature_key = ?',
      [auth.workspaceId, feature_key]
    );

    if (!toggle) {
      throw new Error('Failed to retrieve updated toggle');
    }

    const parsedToggle: FeatureToggle = {
      ...toggle,
      enabled: Boolean(toggle.enabled),
      config: safeJsonParseObject(toggle.config as unknown as string, {}),
    };

    return NextResponse.json({ toggle: parsedToggle });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'update_feature_toggle',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
