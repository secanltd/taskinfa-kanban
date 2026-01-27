/**
 * Error handling utilities with proper categorization and HTTP status codes
 */

import { NextResponse } from 'next/server';

/**
 * Error categories for proper handling and status codes
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NOT_FOUND = 'not_found',
  CONFLICT = 'conflict',
  RATE_LIMIT = 'rate_limit',
  DATABASE = 'database',
  EXTERNAL_SERVICE = 'external_service',
  INTERNAL = 'internal',
}

/**
 * Application error with category and metadata
 */
export class AppError extends Error {
  constructor(
    public category: ErrorCategory,
    message: string,
    public statusCode: number,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Map error category to HTTP status code
 */
function getStatusCode(category: ErrorCategory): number {
  switch (category) {
    case ErrorCategory.VALIDATION:
      return 400;
    case ErrorCategory.AUTHENTICATION:
      return 401;
    case ErrorCategory.AUTHORIZATION:
      return 403;
    case ErrorCategory.NOT_FOUND:
      return 404;
    case ErrorCategory.CONFLICT:
      return 409;
    case ErrorCategory.RATE_LIMIT:
      return 429;
    case ErrorCategory.DATABASE:
    case ErrorCategory.EXTERNAL_SERVICE:
    case ErrorCategory.INTERNAL:
    default:
      return 500;
  }
}

/**
 * Create error response with proper status code and logging
 */
export function createErrorResponse(
  error: unknown,
  context?: { operation?: string; userId?: string; workspaceId?: string }
): NextResponse {
  // Handle AppError instances
  if (error instanceof AppError) {
    const response = {
      error: error.message,
      category: error.category,
      ...(error.metadata && { details: error.metadata }),
    };

    // Log error with context
    logError(error, context);

    return NextResponse.json(response, { status: error.statusCode });
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    logError(error, context);
    return NextResponse.json(
      { error: 'Internal server error', category: ErrorCategory.INTERNAL },
      { status: 500 }
    );
  }

  // Handle unknown errors
  logError(new Error(String(error)), context);
  return NextResponse.json(
    { error: 'An unexpected error occurred', category: ErrorCategory.INTERNAL },
    { status: 500 }
  );
}

/**
 * Log error with structured context (works in Cloudflare Workers)
 */
function logError(
  error: Error | AppError,
  context?: { operation?: string; userId?: string; workspaceId?: string }
) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message: error.message,
    name: error.name,
    stack: error.stack,
    ...(error instanceof AppError && {
      category: error.category,
      statusCode: error.statusCode,
      metadata: error.metadata,
    }),
    ...context,
  };

  // In Cloudflare Workers, console.error writes to stderr which is captured
  console.error(JSON.stringify(logEntry));
}

/**
 * Validation error helper
 */
export function validationError(message: string, details?: Record<string, unknown>): AppError {
  return new AppError(ErrorCategory.VALIDATION, message, 400, details);
}

/**
 * Authentication error helper
 */
export function authenticationError(message = 'Unauthorized'): AppError {
  return new AppError(ErrorCategory.AUTHENTICATION, message, 401);
}

/**
 * Authorization error helper
 */
export function authorizationError(message = 'Forbidden'): AppError {
  return new AppError(ErrorCategory.AUTHORIZATION, message, 403);
}

/**
 * Not found error helper
 */
export function notFoundError(resource: string): AppError {
  return new AppError(ErrorCategory.NOT_FOUND, `${resource} not found`, 404);
}

/**
 * Conflict error helper
 */
export function conflictError(message: string): AppError {
  return new AppError(ErrorCategory.CONFLICT, message, 409);
}

/**
 * Rate limit error helper
 */
export function rateLimitError(resetAt?: number): AppError {
  return new AppError(
    ErrorCategory.RATE_LIMIT,
    'Too many requests',
    429,
    resetAt ? { resetAt } : undefined
  );
}

/**
 * Database error helper
 */
export function databaseError(message: string, metadata?: Record<string, unknown>): AppError {
  return new AppError(ErrorCategory.DATABASE, message, 500, metadata);
}

/**
 * Internal error helper
 */
export function internalError(message: string, metadata?: Record<string, unknown>): AppError {
  return new AppError(ErrorCategory.INTERNAL, message, 500, metadata);
}
