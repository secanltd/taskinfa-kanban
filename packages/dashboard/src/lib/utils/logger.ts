/**
 * Structured logging utilities for Cloudflare Workers
 *
 * In Cloudflare Workers, console logs are captured and available via:
 * - Real-time: `wrangler tail --format pretty`
 * - Dashboard: Workers & Pages → taskinfa-kanban → Logs
 * - Logpush: Send to external services (S3, Datadog, etc.)
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogContext {
  operation?: string;
  userId?: string;
  workspaceId?: string;
  taskId?: string;
  requestId?: string;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    category?: string;
  };
}

/**
 * Get current log level from environment
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  switch (envLevel) {
    case 'debug':
      return LogLevel.DEBUG;
    case 'info':
      return LogLevel.INFO;
    case 'warn':
      return LogLevel.WARN;
    case 'error':
      return LogLevel.ERROR;
    default:
      return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }
}

const currentLogLevel = getLogLevel();

/**
 * Check if a log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
  return levels.indexOf(level) >= levels.indexOf(currentLogLevel);
}

/**
 * Create structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = context;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Include category if it's an AppError
      ...(('category' in error) && { category: (error as any).category }),
    };
  }

  return entry;
}

/**
 * Write log entry to console
 */
function writeLog(entry: LogEntry): void {
  const output = JSON.stringify(entry);

  switch (entry.level) {
    case LogLevel.DEBUG:
      console.debug(output);
      break;
    case LogLevel.INFO:
      console.info(output);
      break;
    case LogLevel.WARN:
      console.warn(output);
      break;
    case LogLevel.ERROR:
      console.error(output);
      break;
  }
}

/**
 * Log debug message
 */
export function debug(message: string, context?: LogContext): void {
  if (shouldLog(LogLevel.DEBUG)) {
    writeLog(createLogEntry(LogLevel.DEBUG, message, context));
  }
}

/**
 * Log info message
 */
export function info(message: string, context?: LogContext): void {
  if (shouldLog(LogLevel.INFO)) {
    writeLog(createLogEntry(LogLevel.INFO, message, context));
  }
}

/**
 * Log warning message
 */
export function warn(message: string, context?: LogContext): void {
  if (shouldLog(LogLevel.WARN)) {
    writeLog(createLogEntry(LogLevel.WARN, message, context));
  }
}

/**
 * Log error message
 */
export function error(message: string, error?: Error, context?: LogContext): void {
  if (shouldLog(LogLevel.ERROR)) {
    writeLog(createLogEntry(LogLevel.ERROR, message, context, error));
  }
}

/**
 * Create a logger with bound context
 */
export function createLogger(defaultContext: LogContext) {
  return {
    debug: (message: string, context?: LogContext) =>
      debug(message, { ...defaultContext, ...context }),
    info: (message: string, context?: LogContext) =>
      info(message, { ...defaultContext, ...context }),
    warn: (message: string, context?: LogContext) =>
      warn(message, { ...defaultContext, ...context }),
    error: (message: string, errorObj?: Error, context?: LogContext) =>
      error(message, errorObj, { ...defaultContext, ...context }),
  };
}

/**
 * Measure operation duration
 */
export async function measureOperation<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const start = performance.now();

  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);

    info(`Operation completed: ${operation}`, {
      ...context,
      operation,
      duration,
      status: 'success',
    });

    return result;
  } catch (err) {
    const duration = Math.round(performance.now() - start);

    error(
      `Operation failed: ${operation}`,
      err instanceof Error ? err : new Error(String(err)),
      {
        ...context,
        operation,
        duration,
        status: 'error',
      }
    );

    throw err;
  }
}

/**
 * Log request/response for API endpoints
 */
export function logRequest(
  method: string,
  path: string,
  context?: LogContext
): void {
  info(`${method} ${path}`, {
    ...context,
    operation: 'http_request',
    method,
    path,
  });
}

export function logResponse(
  method: string,
  path: string,
  status: number,
  duration: number,
  context?: LogContext
): void {
  const level = status >= 500 ? LogLevel.ERROR : status >= 400 ? LogLevel.WARN : LogLevel.INFO;

  const entry = createLogEntry(
    level,
    `${method} ${path} - ${status}`,
    {
      ...context,
      operation: 'http_response',
      method,
      path,
      status,
      duration,
    }
  );

  writeLog(entry);
}

/**
 * Default logger instance
 */
export const logger = {
  debug,
  info,
  warn,
  error,
  createLogger,
  measureOperation,
  logRequest,
  logResponse,
};
