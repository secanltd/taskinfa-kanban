// API Route: /api/feature-toggles
// List all feature toggles for a workspace

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query } from '@/lib/db/client';
import type { FeatureToggle, FeatureKey } from '@taskinfa/shared';
import { DEFAULT_FEATURE_CONFIGS } from '@taskinfa/shared';
import {
  safeJsonParseObject,
  createErrorResponse,
  authenticationError,
} from '@/lib/utils';

const ALL_FEATURE_KEYS: FeatureKey[] = ['refinement', 'ai_review'];

// GET /api/feature-toggles - List all toggles for workspace
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }

    const db = getDb();
    const rows = await query<FeatureToggle>(
      db,
      'SELECT * FROM feature_toggles WHERE workspace_id = ? ORDER BY feature_key ASC',
      [auth.workspaceId]
    );

    // Build a map of existing toggles
    const existingMap = new Map<string, FeatureToggle>();
    for (const row of rows) {
      existingMap.set(row.feature_key, {
        ...row,
        enabled: Boolean(row.enabled),
        config: safeJsonParseObject(row.config as unknown as string, {}),
      });
    }

    // Return all known feature keys, with defaults for any not yet in DB
    const toggles: FeatureToggle[] = ALL_FEATURE_KEYS.map((key) => {
      if (existingMap.has(key)) {
        return existingMap.get(key)!;
      }
      return {
        id: '',
        workspace_id: auth.workspaceId,
        feature_key: key,
        enabled: false,
        config: DEFAULT_FEATURE_CONFIGS[key],
        created_at: '',
        updated_at: '',
      };
    });

    return NextResponse.json({ toggles });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'list_feature_toggles',
      workspaceId: (await authenticateRequestUnified(request))?.workspaceId,
    });
  }
}
