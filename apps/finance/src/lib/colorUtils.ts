/**
 * Utility functions for determining text colors based on background colors and theme
 */

export const getAccentTextColor = (
  isDarkMode: boolean,
  isDefaultAccent: boolean
): string => {
  if (isDarkMode && isDefaultAccent) {
    return 'text-black';
  }
  return 'text-[var(--color-on-accent)]';
};

export const getAccentTextColorWithOpacity = (
  isDarkMode: boolean,
  isDefaultAccent: boolean,
  opacity: number = 0.8
): string => {
  if (isDarkMode && isDefaultAccent) {
    return `text-black/[${Math.round(opacity * 100)}]`;
  }
  return `text-[var(--color-on-accent)]/[${Math.round(opacity * 100)}]`;
};

export const getAccentIconColor = (
  isDarkMode: boolean,
  isDefaultAccent: boolean
): string => {
  if (isDarkMode && isDefaultAccent) {
    return 'text-black';
  }
  return 'text-[var(--color-on-accent)]';
};
