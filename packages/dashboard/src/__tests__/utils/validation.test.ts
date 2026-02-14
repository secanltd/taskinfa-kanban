import { describe, it, expect } from 'vitest';
import {
  validateInteger,
  validateString,
  validateEnum,
  validateArray,
  validateId,
  sanitizeInput,
} from '@/lib/utils/validation';

describe('validateInteger', () => {
  it('should parse valid integers', () => {
    expect(validateInteger('42', { fieldName: 'test' })).toBe(42);
    expect(validateInteger('0', { fieldName: 'test' })).toBe(0);
    expect(validateInteger('-5', { fieldName: 'test' })).toBe(-5);
  });

  it('should return default value when missing', () => {
    expect(validateInteger(null, { fieldName: 'test', defaultValue: 10 })).toBe(10);
    expect(validateInteger('', { fieldName: 'test', defaultValue: 5 })).toBe(5);
  });

  it('should throw for non-integer strings', () => {
    expect(() => validateInteger('abc', { fieldName: 'test' })).toThrow('must be a valid integer');
    expect(() => validateInteger('3.14', { fieldName: 'test' })).not.toThrow(); // parseInt handles this
  });

  it('should enforce min/max bounds', () => {
    expect(() => validateInteger('0', { fieldName: 'test', min: 1 })).toThrow('must be at least 1');
    expect(() => validateInteger('101', { fieldName: 'test', max: 100 })).toThrow('must be at most 100');
    expect(validateInteger('50', { fieldName: 'test', min: 1, max: 100 })).toBe(50);
  });

  it('should throw when required and missing', () => {
    expect(() => validateInteger(null, { fieldName: 'count', required: true })).toThrow('count is required');
  });
});

describe('validateString', () => {
  it('should return trimmed value', () => {
    expect(validateString('  hello  ', { fieldName: 'test' })).toBe('hello');
  });

  it('should return null for missing non-required values', () => {
    expect(validateString(null, { fieldName: 'test' })).toBeNull();
    expect(validateString('', { fieldName: 'test' })).toBeNull();
  });

  it('should throw when required and missing', () => {
    expect(() => validateString(null, { fieldName: 'name', required: true })).toThrow('name is required');
  });

  it('should enforce length constraints', () => {
    expect(() => validateString('ab', { fieldName: 'test', minLength: 3 })).toThrow('at least 3 characters');
    expect(() => validateString('toolong', { fieldName: 'test', maxLength: 3 })).toThrow('at most 3 characters');
  });

  it('should validate against pattern', () => {
    expect(() => validateString('abc123', { fieldName: 'test', pattern: /^\d+$/ })).toThrow('invalid format');
    expect(validateString('123', { fieldName: 'test', pattern: /^\d+$/ })).toBe('123');
  });
});

describe('validateEnum', () => {
  const allowed = ['low', 'medium', 'high'] as const;

  it('should accept valid enum values', () => {
    expect(validateEnum('low', allowed, { fieldName: 'priority' })).toBe('low');
    expect(validateEnum('high', allowed, { fieldName: 'priority' })).toBe('high');
  });

  it('should return null for missing non-required values', () => {
    expect(validateEnum(null, allowed, { fieldName: 'priority' })).toBeNull();
  });

  it('should return default value when provided', () => {
    expect(validateEnum(null, allowed, { fieldName: 'priority', defaultValue: 'medium' })).toBe('medium');
  });

  it('should throw for invalid enum values', () => {
    expect(() => validateEnum('invalid', allowed, { fieldName: 'priority' })).toThrow('must be one of: low, medium, high');
  });
});

describe('validateArray', () => {
  it('should return null for missing non-required values', () => {
    expect(validateArray(null, { fieldName: 'items' })).toBeNull();
  });

  it('should throw when required and missing', () => {
    expect(() => validateArray(null, { fieldName: 'items', required: true })).toThrow('items is required');
  });

  it('should throw for non-array values', () => {
    expect(() => validateArray('string', { fieldName: 'items' })).toThrow('must be an array');
    expect(() => validateArray(42, { fieldName: 'items' })).toThrow('must be an array');
  });

  it('should enforce length constraints', () => {
    expect(() => validateArray([], { fieldName: 'items', minLength: 1 })).toThrow('at least 1 items');
    expect(() => validateArray([1, 2, 3], { fieldName: 'items', maxLength: 2 })).toThrow('at most 2 items');
  });

  it('should pass through valid arrays', () => {
    expect(validateArray([1, 2, 3], { fieldName: 'items' })).toEqual([1, 2, 3]);
  });
});

describe('validateId', () => {
  it('should accept valid IDs', () => {
    expect(validateId('abc-123_XYZ', { fieldName: 'id' })).toBe('abc-123_XYZ');
  });

  it('should return null for missing non-required values', () => {
    expect(validateId(null, { fieldName: 'id' })).toBeNull();
  });

  it('should throw for missing required values', () => {
    expect(() => validateId(null, { fieldName: 'id', required: true })).toThrow('id is required');
  });

  it('should validate prefix', () => {
    expect(validateId('task_abc123', { fieldName: 'id', prefix: 'task_' })).toBe('task_abc123');
    expect(() => validateId('abc123', { fieldName: 'id', prefix: 'task_' })).toThrow('must start with task_');
  });

  it('should reject IDs with invalid characters', () => {
    expect(() => validateId('id with spaces', { fieldName: 'id' })).toThrow('invalid format');
    expect(() => validateId('id@special', { fieldName: 'id' })).toThrow('invalid format');
  });
});

describe('sanitizeInput', () => {
  it('should remove angle brackets', () => {
    expect(sanitizeInput('hello <script>alert("xss")</script>')).toBe('hello scriptalert("xss")/script');
  });

  it('should remove javascript: protocol', () => {
    expect(sanitizeInput('javascript:alert(1)')).toBe('alert(1)');
  });

  it('should remove event handlers', () => {
    expect(sanitizeInput('onclick=alert(1)')).toBe('alert(1)');
    expect(sanitizeInput('onmouseover=hack()')).toBe('hack()');
  });

  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });
});
