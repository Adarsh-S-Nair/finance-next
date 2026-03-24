/**
 * Capitalize first letter, lowercase the rest.
 * "zENTARI" → "Zentari", "JOHN" → "John"
 */
export function capitalizeFirstOnly(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
