import { describe, it, expect } from 'vitest';
import {
  AppError,
  ErrorCategory,
  validationError,
  authenticationError,
  authorizationError,
  notFoundError,
  conflictError,
  rateLimitError,
  databaseError,
  internalError,
} from '@/lib/utils/errors';

describe('AppError', () => {
  it('should create an error with category and status code', () => {
    const error = new AppError(ErrorCategory.VALIDATION, 'Invalid input', 400);
    expect(error.message).toBe('Invalid input');
    expect(error.category).toBe(ErrorCategory.VALIDATION);
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('AppError');
    expect(error).toBeInstanceOf(Error);
  });

  it('should support metadata', () => {
    const error = new AppError(ErrorCategory.VALIDATION, 'Bad', 400, { field: 'email' });
    expect(error.metadata).toEqual({ field: 'email' });
  });
});

describe('error helpers', () => {
  it('validationError should return 400', () => {
    const err = validationError('Bad input');
    expect(err.statusCode).toBe(400);
    expect(err.category).toBe(ErrorCategory.VALIDATION);
    expect(err.message).toBe('Bad input');
  });

  it('authenticationError should return 401', () => {
    const err = authenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Unauthorized');
  });

  it('authenticationError should accept custom message', () => {
    const err = authenticationError('Invalid token');
    expect(err.message).toBe('Invalid token');
  });

  it('authorizationError should return 403', () => {
    const err = authorizationError();
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Forbidden');
  });

  it('notFoundError should return 404', () => {
    const err = notFoundError('Task');
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Task not found');
  });

  it('conflictError should return 409', () => {
    const err = conflictError('Already exists');
    expect(err.statusCode).toBe(409);
  });

  it('rateLimitError should return 429', () => {
    const err = rateLimitError(12345);
    expect(err.statusCode).toBe(429);
    expect(err.metadata).toEqual({ resetAt: 12345 });
  });

  it('databaseError should return 500', () => {
    const err = databaseError('Query failed');
    expect(err.statusCode).toBe(500);
    expect(err.category).toBe(ErrorCategory.DATABASE);
  });

  it('internalError should return 500', () => {
    const err = internalError('Something broke');
    expect(err.statusCode).toBe(500);
    expect(err.category).toBe(ErrorCategory.INTERNAL);
  });
});
