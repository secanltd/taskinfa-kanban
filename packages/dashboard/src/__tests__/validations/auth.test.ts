import { describe, it, expect } from 'vitest';
import { validateEmail, normalizeEmail } from '@/lib/validations/auth';

describe('validateEmail', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('user.name@example.co.uk')).toBe(true);
    expect(validateEmail('test+tag@example.com')).toBe(true);
    expect(validateEmail('user123@domain.io')).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('')).toBe(false);
    expect(validateEmail('notanemail')).toBe(false);
    expect(validateEmail('@example.com')).toBe(false);
    expect(validateEmail('test@')).toBe(false);
    expect(validateEmail('test@.com')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('should convert email to lowercase', () => {
    expect(normalizeEmail('Test@Example.COM')).toBe('test@example.com');
    expect(normalizeEmail('USER@DOMAIN.COM')).toBe('user@domain.com');
  });

  it('should trim whitespace', () => {
    expect(normalizeEmail('  test@example.com  ')).toBe('test@example.com');
    expect(normalizeEmail('\ttest@example.com\n')).toBe('test@example.com');
  });

  it('should handle combined normalization', () => {
    expect(normalizeEmail('  Test@Example.COM  ')).toBe('test@example.com');
  });
});
