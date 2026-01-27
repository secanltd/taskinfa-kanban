/**
 * Utility functions for the dashboard application
 */

// JSON utilities
export {
  safeJsonParse,
  safeJsonStringify,
  safeJsonParseArray,
  safeJsonParseObject,
} from './json';

// Error handling utilities
export {
  AppError,
  ErrorCategory,
  createErrorResponse,
  validationError,
  authenticationError,
  authorizationError,
  notFoundError,
  conflictError,
  rateLimitError,
  databaseError,
  internalError,
} from './errors';

// Validation utilities
export {
  validateInteger,
  validateString,
  validateEnum,
  validateArray,
  validateId,
  sanitizeInput,
} from './validation';

// Logging utilities
export {
  logger,
  createLogger,
  measureOperation,
  logRequest,
  logResponse,
  LogLevel,
  type LogContext,
} from './logger';
