/**
 * Safe JSON parsing utilities to prevent runtime crashes from malformed JSON
 */

/**
 * Safely parse JSON with fallback value
 * @param json - JSON string to parse
 * @param fallback - Value to return if parsing fails
 * @returns Parsed JSON or fallback value
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) {
    return fallback;
  }

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.warn('JSON parse failed, using fallback:', { json, error });
    return fallback;
  }
}

/**
 * Safely stringify JSON with fallback
 * @param value - Value to stringify
 * @param fallback - String to return if stringification fails (default: '{}')
 * @returns JSON string or fallback
 */
export function safeJsonStringify(value: unknown, fallback = '{}'): string {
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.warn('JSON stringify failed, using fallback:', { value, error });
    return fallback;
  }
}

/**
 * Parse JSON array safely
 * @param json - JSON string that should be an array
 * @param fallback - Array to return if parsing fails or result is not an array
 * @returns Parsed array or fallback
 */
export function safeJsonParseArray<T>(json: string | null | undefined, fallback: T[] = []): T[] {
  const parsed = safeJsonParse(json, fallback);
  return Array.isArray(parsed) ? parsed : fallback;
}

/**
 * Parse JSON object safely
 * @param json - JSON string that should be an object
 * @param fallback - Object to return if parsing fails or result is not an object
 * @returns Parsed object or fallback
 */
export function safeJsonParseObject<T extends Record<string, unknown>>(
  json: string | null | undefined,
  fallback: T = {} as T
): T {
  const parsed = safeJsonParse(json, fallback);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as T)
    : fallback;
}
