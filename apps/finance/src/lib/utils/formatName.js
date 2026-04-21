/**
 * Capitalize first letter, lowercase the rest.
 * "zERVO" → "Zervo", "JOHN" → "John"
 */
export function capitalizeFirstOnly(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Proper-case a full name: capitalize the first letter of each word, lowercase the rest.
 * "zERVO dEV" → "Zervo Dev", "JOHN DOE" → "John Doe"
 */
export function formatDisplayName(str) {
  if (!str) return '';
  return str.trim().split(/\s+/).map(capitalizeFirstOnly).join(' ');
}
