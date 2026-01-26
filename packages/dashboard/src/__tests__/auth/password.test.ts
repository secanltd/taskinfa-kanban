import { describe, it, expect } from '@jest/globals';
import { validatePassword } from '@/lib/auth/password';

describe('Password Validation', () => {
  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('Test123');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should reject passwords without uppercase', () => {
    const result = validatePassword('test1234');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
  });

  it('should reject passwords without lowercase', () => {
    const result = validatePassword('TEST1234');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one lowercase letter');
  });

  it('should reject passwords without numbers', () => {
    const result = validatePassword('TestTest');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must contain at least one number');
  });

  it('should accept valid passwords', () => {
    const result = validatePassword('Test1234');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept strong passwords', () => {
    const result = validatePassword('MySecure123Password!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
