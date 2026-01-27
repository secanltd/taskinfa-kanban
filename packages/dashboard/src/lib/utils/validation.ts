/**
 * Input validation utilities for API parameters
 */

import { validationError } from './errors';

/**
 * Validate and parse integer with bounds
 */
export function validateInteger(
  value: string | null | undefined,
  options: {
    fieldName: string;
    min?: number;
    max?: number;
    defaultValue?: number;
    required?: boolean;
  }
): number {
  const { fieldName, min, max, defaultValue, required = false } = options;

  // Handle missing value
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw validationError(`${fieldName} is required`);
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw validationError(`${fieldName} is required`);
  }

  // Parse integer
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw validationError(`${fieldName} must be a valid integer`);
  }

  // Check minimum bound
  if (min !== undefined && parsed < min) {
    throw validationError(`${fieldName} must be at least ${min}`);
  }

  // Check maximum bound
  if (max !== undefined && parsed > max) {
    throw validationError(`${fieldName} must be at most ${max}`);
  }

  return parsed;
}

/**
 * Validate string with length constraints
 */
export function validateString(
  value: string | null | undefined,
  options: {
    fieldName: string;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    required?: boolean;
    trim?: boolean;
  }
): string | null {
  const { fieldName, minLength, maxLength, pattern, required = false, trim = true } = options;

  // Handle missing value
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw validationError(`${fieldName} is required`);
    }
    return null;
  }

  // Trim if requested
  const processedValue = trim ? value.trim() : value;

  // Check if empty after trimming
  if (required && processedValue === '') {
    throw validationError(`${fieldName} cannot be empty`);
  }

  // Check minimum length
  if (minLength !== undefined && processedValue.length < minLength) {
    throw validationError(`${fieldName} must be at least ${minLength} characters`);
  }

  // Check maximum length
  if (maxLength !== undefined && processedValue.length > maxLength) {
    throw validationError(`${fieldName} must be at most ${maxLength} characters`);
  }

  // Check pattern
  if (pattern && !pattern.test(processedValue)) {
    throw validationError(`${fieldName} has invalid format`);
  }

  return processedValue;
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: string | null | undefined,
  allowedValues: readonly T[],
  options: {
    fieldName: string;
    required?: boolean;
    defaultValue?: T;
  }
): T | null {
  const { fieldName, required = false, defaultValue } = options;

  // Handle missing value
  if (value === null || value === undefined || value === '') {
    if (required && !defaultValue) {
      throw validationError(`${fieldName} is required`);
    }
    return defaultValue || null;
  }

  // Check if value is in allowed values
  if (!allowedValues.includes(value as T)) {
    throw validationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`,
      { provided: value, allowed: [...allowedValues] }
    );
  }

  return value as T;
}

/**
 * Validate array with constraints
 */
export function validateArray<T>(
  value: unknown,
  options: {
    fieldName: string;
    minLength?: number;
    maxLength?: number;
    required?: boolean;
    itemValidator?: (item: unknown, index: number) => T;
  }
): T[] | null {
  const { fieldName, minLength, maxLength, required = false, itemValidator } = options;

  // Handle missing value
  if (value === null || value === undefined) {
    if (required) {
      throw validationError(`${fieldName} is required`);
    }
    return null;
  }

  // Check if value is an array
  if (!Array.isArray(value)) {
    throw validationError(`${fieldName} must be an array`);
  }

  // Check minimum length
  if (minLength !== undefined && value.length < minLength) {
    throw validationError(`${fieldName} must have at least ${minLength} items`);
  }

  // Check maximum length
  if (maxLength !== undefined && value.length > maxLength) {
    throw validationError(`${fieldName} must have at most ${maxLength} items`);
  }

  // Validate items if validator provided
  if (itemValidator) {
    return value.map((item, index) => itemValidator(item, index));
  }

  return value as T[];
}

/**
 * Sanitize HTML/SQL to prevent injection attacks
 */
export function sanitizeInput(value: string): string {
  // Remove potential XSS vectors
  return value
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .trim();
}

/**
 * Validate ID format (nanoid or custom format)
 */
export function validateId(
  value: string | null | undefined,
  options: {
    fieldName: string;
    prefix?: string;
    required?: boolean;
  }
): string | null {
  const { fieldName, prefix, required = false } = options;

  // Handle missing value
  if (value === null || value === undefined || value === '') {
    if (required) {
      throw validationError(`${fieldName} is required`);
    }
    return null;
  }

  // Check prefix if provided
  if (prefix && !value.startsWith(prefix)) {
    throw validationError(`${fieldName} must start with ${prefix}`);
  }

  // Basic format validation (alphanumeric, dashes, underscores)
  const idPattern = /^[a-zA-Z0-9_-]+$/;
  if (!idPattern.test(value)) {
    throw validationError(`${fieldName} has invalid format`);
  }

  return value;
}
