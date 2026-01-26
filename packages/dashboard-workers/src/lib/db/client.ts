// D1 Database Client
// This module provides a simple interface to Cloudflare D1 database

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<T[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run(): Promise<D1Result>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  meta?: Record<string, any>;
  error?: string;
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

// Get D1 database instance from environment
export function getDb(): D1Database {
  // In Cloudflare Workers/Pages, access via process.env
  const env = process.env as any;
  if (!env.DB) {
    throw new Error('D1 database binding not found. Make sure DB is configured in wrangler.toml');
  }
  return env.DB;
}

// Helper to execute a query and return results
export async function query<T = any>(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  const result = await bound.all<T>();

  if (!result.success) {
    throw new Error(`Database query failed: ${result.error}`);
  }

  return result.results || [];
}

// Helper to execute a query and return first result
export async function queryOne<T = any>(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return await bound.first<T>();
}

// Helper to execute an insert/update/delete
export async function execute(
  db: D1Database,
  sql: string,
  params: any[] = []
): Promise<D1Result> {
  const stmt = db.prepare(sql);
  const bound = params.length > 0 ? stmt.bind(...params) : stmt;
  return await bound.run();
}
