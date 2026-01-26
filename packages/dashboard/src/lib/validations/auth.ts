// Email validation utilities

/**
 * Validate email format using a regex pattern
 * @param email - Email address to validate
 * @returns true if email format is valid
 */
export function validateEmail(email: string): boolean {
  if (!email) {
    return false;
  }

  // RFC 5322 compliant email regex (simplified version)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailRegex.test(email.toLowerCase());
}

/**
 * Normalize email address (lowercase, trim whitespace)
 * @param email - Email address to normalize
 * @returns Normalized email address
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
