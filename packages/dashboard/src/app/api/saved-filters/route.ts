import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, execute } from '@/lib/db/client';
import { nanoid } from 'nanoid';
import {
  createErrorResponse,
  authenticationError,
  validationError,
  validateString,
} from '@/lib/utils';

// GET /api/saved-filters - List saved filters for current user
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) throw authenticationError();

    const db = getDb();
    const filters = await query(
      db,
      'SELECT * FROM saved_filters WHERE workspace_id = ? AND user_id = ? ORDER BY created_at DESC',
      [auth.workspaceId, auth.userId || '']
    );

    return NextResponse.json({ filters });
  } catch (error) {
    return createErrorResponse(error, { operation: 'list_saved_filters' });
  }
}

// POST /api/saved-filters - Create a saved filter
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) throw authenticationError();

    const body = await request.json() as { name?: string; filters?: Record<string, unknown> };
    const name = validateString(body.name, { fieldName: 'name', required: true, minLength: 1, maxLength: 100 });
    if (!name) throw validationError('Name is required');

    if (!body.filters || typeof body.filters !== 'object') {
      throw validationError('Filters object is required');
    }

    const db = getDb();
    const id = `sf_${nanoid()}`;

    await execute(
      db,
      'INSERT INTO saved_filters (id, workspace_id, user_id, name, filters) VALUES (?, ?, ?, ?, ?)',
      [id, auth.workspaceId, auth.userId || '', name, JSON.stringify(body.filters)]
    );

    const filter = await query(db, 'SELECT * FROM saved_filters WHERE id = ?', [id]);

    return NextResponse.json({ filter: filter[0] }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, { operation: 'create_saved_filter' });
  }
}
