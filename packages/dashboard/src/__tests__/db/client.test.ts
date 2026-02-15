import { describe, it, expect, vi, beforeEach } from 'vitest';
import { query, queryOne, execute } from '@/lib/db/client';
import type { D1Database, D1PreparedStatement, D1Result } from '@/lib/db/client';

// Create mock D1 database
function createMockDb(overrides?: Partial<D1Database>): D1Database {
  const mockStmt: D1PreparedStatement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue({ success: true, results: [] }),
  };

  return {
    prepare: vi.fn().mockReturnValue(mockStmt),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
    ...overrides,
  };
}

describe('query', () => {
  it('should execute SELECT query and return results', async () => {
    const mockResults = [
      { id: '1', name: 'Task 1' },
      { id: '2', name: 'Task 2' },
    ];
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ success: true, results: mockResults }),
    };
    const db = createMockDb({ prepare: vi.fn().mockReturnValue(mockStmt) });

    const results = await query(db, 'SELECT * FROM tasks WHERE workspace_id = ?', ['ws_1']);

    expect(db.prepare).toHaveBeenCalledWith('SELECT * FROM tasks WHERE workspace_id = ?');
    expect(mockStmt.bind).toHaveBeenCalledWith('ws_1');
    expect(results).toEqual(mockResults);
  });

  it('should handle queries without parameters', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ success: true, results: [{ count: 5 }] }),
    };
    const db = createMockDb({ prepare: vi.fn().mockReturnValue(mockStmt) });

    const results = await query(db, 'SELECT COUNT(*) as count FROM tasks');

    expect(mockStmt.bind).not.toHaveBeenCalled();
    expect(results).toEqual([{ count: 5 }]);
  });

  it('should throw on failed query', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ success: false, error: 'table not found' }),
    };
    const db = createMockDb({ prepare: vi.fn().mockReturnValue(mockStmt) });

    await expect(query(db, 'SELECT * FROM nonexistent')).rejects.toThrow('Database query failed');
  });

  it('should return empty array when results are undefined', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn(),
      all: vi.fn().mockResolvedValue({ success: true }),
    };
    const db = createMockDb({ prepare: vi.fn().mockReturnValue(mockStmt) });

    const results = await query(db, 'SELECT * FROM tasks');
    expect(results).toEqual([]);
  });
});

describe('queryOne', () => {
  it('should return first result', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ id: '1', name: 'Task 1' }),
      run: vi.fn(),
      all: vi.fn(),
    };
    const db = createMockDb({ prepare: vi.fn().mockReturnValue(mockStmt) });

    const result = await queryOne(db, 'SELECT * FROM tasks WHERE id = ?', ['1']);

    expect(result).toEqual({ id: '1', name: 'Task 1' });
    expect(mockStmt.bind).toHaveBeenCalledWith('1');
  });

  it('should return null when no results', async () => {
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn(),
      all: vi.fn(),
    };
    const db = createMockDb({ prepare: vi.fn().mockReturnValue(mockStmt) });

    const result = await queryOne(db, 'SELECT * FROM tasks WHERE id = ?', ['nonexistent']);
    expect(result).toBeNull();
  });
});

describe('execute', () => {
  it('should execute INSERT/UPDATE/DELETE', async () => {
    const mockResult: D1Result = { success: true };
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn().mockResolvedValue(mockResult),
      all: vi.fn(),
    };
    const db = createMockDb({ prepare: vi.fn().mockReturnValue(mockStmt) });

    const result = await execute(db, 'INSERT INTO tasks (id, title) VALUES (?, ?)', ['1', 'New Task']);

    expect(db.prepare).toHaveBeenCalledWith('INSERT INTO tasks (id, title) VALUES (?, ?)');
    expect(mockStmt.bind).toHaveBeenCalledWith('1', 'New Task');
    expect(result.success).toBe(true);
  });

  it('should handle execute without parameters', async () => {
    const mockResult: D1Result = { success: true };
    const mockStmt = {
      bind: vi.fn().mockReturnThis(),
      first: vi.fn(),
      run: vi.fn().mockResolvedValue(mockResult),
      all: vi.fn(),
    };
    const db = createMockDb({ prepare: vi.fn().mockReturnValue(mockStmt) });

    const result = await execute(db, 'DELETE FROM tasks');

    expect(mockStmt.bind).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
