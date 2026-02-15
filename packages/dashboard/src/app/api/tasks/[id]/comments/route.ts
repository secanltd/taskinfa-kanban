// API Route: /api/tasks/[id]/comments
// List and create task comments

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequestUnified } from '@/lib/auth/jwt';
import { getDb, query, queryOne, execute } from '@/lib/db/client';
import { rateLimitApi } from '@/lib/middleware/apiRateLimit';
import type { Task, TaskComment } from '@taskinfa/shared';
import { nanoid } from 'nanoid';
import {
  createErrorResponse,
  authenticationError,
  notFoundError,
  validationError,
} from '@/lib/utils';

// GET /api/tasks/[id]/comments - List comments for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const { id } = await params;
    const db = getDb();

    // Verify task exists and belongs to workspace
    const task = await queryOne<Task>(
      db,
      'SELECT id FROM tasks WHERE id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    if (!task) {
      throw notFoundError('Task');
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      db,
      'SELECT COUNT(*) as total FROM task_comments WHERE task_id = ?',
      [id]
    );

    // Get comments (newest first)
    const comments = await query<TaskComment>(
      db,
      'SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [id, limit, offset]
    );

    return NextResponse.json({
      comments,
      total: countResult?.total ?? 0,
    });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'list_comments',
    });
  }
}

// POST /api/tasks/[id]/comments - Create a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequestUnified(request);
    if (!auth) {
      throw authenticationError();
    }
    const rl = await rateLimitApi(request, auth);
    if ('response' in rl) return rl.response;

    const { id } = await params;
    const body = await request.json() as {
      author?: string;
      author_type?: string;
      content?: string;
      comment_type?: string;
      loop_number?: number;
    };

    const { author, author_type, content, comment_type, loop_number } = body;

    if (!author || typeof author !== 'string') {
      throw validationError('author is required');
    }
    if (!author_type || !['bot', 'user'].includes(author_type)) {
      throw validationError('author_type must be "bot" or "user"');
    }
    if (!content || typeof content !== 'string') {
      throw validationError('content is required');
    }
    if (!comment_type || !['progress', 'question', 'summary', 'error', 'human_message'].includes(comment_type)) {
      throw validationError('comment_type must be one of: progress, question, summary, error, human_message');
    }

    const db = getDb();

    // Verify task exists and belongs to workspace
    const task = await queryOne<Task>(
      db,
      'SELECT id FROM tasks WHERE id = ? AND workspace_id = ?',
      [id, auth.workspaceId]
    );

    if (!task) {
      throw notFoundError('Task');
    }

    const commentId = `cmt_${nanoid()}`;

    await execute(
      db,
      `INSERT INTO task_comments (id, task_id, author, author_type, content, comment_type, loop_number)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [commentId, id, author.trim(), author_type, content.trim(), comment_type, loop_number ?? null]
    );

    const comment = await queryOne<TaskComment>(
      db,
      'SELECT * FROM task_comments WHERE id = ?',
      [commentId]
    );

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, {
      operation: 'add_comment',
    });
  }
}
