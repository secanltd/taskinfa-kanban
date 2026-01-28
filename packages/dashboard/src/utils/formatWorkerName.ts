/**
 * Formats a worker name from kebab-case or snake_case to Title Case
 * Examples:
 *   - "dev-gordon" -> "Dev Gordon"
 *   - "rev-johny-1" -> "Rev Johny 1"
 *   - "bot_alice" -> "Bot Alice"
 *   - "WORKER_BOB" -> "Worker Bob"
 */
export function formatWorkerName(name: string): string {
  return name
    .split(/[-_]/)
    .map(word => {
      if (!word) return '';
      // Handle all-uppercase words (like "WORKER")
      if (word === word.toUpperCase() && word.length > 1) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Get initials from a formatted worker name
 * Examples:
 *   - "Dev Gordon" -> "DG"
 *   - "Rev Johny 1" -> "RJ"
 */
export function getWorkerInitials(name: string): string {
  const formatted = formatWorkerName(name);
  const words = formatted.split(' ').filter(word => isNaN(Number(word)));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
}
