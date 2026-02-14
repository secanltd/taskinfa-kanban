import { describe, it, expect } from 'vitest';
import {
  safeJsonParse,
  safeJsonStringify,
  safeJsonParseArray,
  safeJsonParseObject,
} from '@/lib/utils/json';

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    expect(safeJsonParse('{"key":"value"}', {})).toEqual({ key: 'value' });
    expect(safeJsonParse('[1,2,3]', [])).toEqual([1, 2, 3]);
    expect(safeJsonParse('"hello"', '')).toBe('hello');
  });

  it('should return fallback for invalid JSON', () => {
    expect(safeJsonParse('invalid', 'fallback')).toBe('fallback');
    expect(safeJsonParse('{broken', {})).toEqual({});
  });

  it('should return fallback for null/undefined', () => {
    expect(safeJsonParse(null, 'default')).toBe('default');
    expect(safeJsonParse(undefined, 'default')).toBe('default');
    expect(safeJsonParse('', 'default')).toBe('default');
  });
});

describe('safeJsonStringify', () => {
  it('should stringify valid objects', () => {
    expect(safeJsonStringify({ key: 'value' })).toBe('{"key":"value"}');
    expect(safeJsonStringify([1, 2, 3])).toBe('[1,2,3]');
  });

  it('should return fallback for circular references', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(safeJsonStringify(circular)).toBe('{}');
  });
});

describe('safeJsonParseArray', () => {
  it('should parse valid JSON arrays', () => {
    expect(safeJsonParseArray('["a","b"]')).toEqual(['a', 'b']);
    expect(safeJsonParseArray('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('should return fallback for non-array JSON', () => {
    expect(safeJsonParseArray('{"key":"value"}')).toEqual([]);
    expect(safeJsonParseArray('"string"')).toEqual([]);
  });

  it('should return fallback for null/undefined', () => {
    expect(safeJsonParseArray(null)).toEqual([]);
    expect(safeJsonParseArray(undefined)).toEqual([]);
  });

  it('should use custom fallback', () => {
    expect(safeJsonParseArray('invalid', ['default'])).toEqual(['default']);
  });
});

describe('safeJsonParseObject', () => {
  it('should parse valid JSON objects', () => {
    expect(safeJsonParseObject('{"key":"value"}')).toEqual({ key: 'value' });
  });

  it('should return fallback for arrays', () => {
    expect(safeJsonParseObject('[1,2,3]')).toEqual({});
  });

  it('should return fallback for null JSON', () => {
    expect(safeJsonParseObject('null')).toEqual({});
  });

  it('should return fallback for null/undefined input', () => {
    expect(safeJsonParseObject(null)).toEqual({});
    expect(safeJsonParseObject(undefined)).toEqual({});
  });
});
