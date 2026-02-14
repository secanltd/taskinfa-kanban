import { describe, it, expect } from 'vitest';
import { validatePassword, hashPassword, verifyPassword } from '@/lib/auth/password';

describe('validatePassword', () => {
  it('should reject empty password', () => {
    const result = validatePassword('');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password is required');
  });

  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('Test12');
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

  it('should return multiple errors for very weak passwords', () => {
    const result = validatePassword('abc');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('should accept valid passwords', () => {
    const result = validatePassword('Test1234');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should accept strong passwords with special characters', () => {
    const result = validatePassword('MySecure123Password!');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('hashPassword and verifyPassword', () => {
  it('should hash and verify a password correctly', async () => {
    const password = 'Test1234!';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix

    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await hashPassword('Test1234!');
    const isValid = await verifyPassword('WrongPass1', hash);
    expect(isValid).toBe(false);
  });

  it('should produce different hashes for same password', async () => {
    const password = 'Test1234!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    expect(hash1).not.toBe(hash2); // bcrypt uses random salt
  });
});
