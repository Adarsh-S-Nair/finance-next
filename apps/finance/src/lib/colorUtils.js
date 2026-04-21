/**
 * Utility functions for determining text colors based on background colors and theme
 */

/**
 * Determines the appropriate text color for accent backgrounds
 * @param {boolean} isDarkMode - Whether the app is in dark mode
 * @param {boolean} isDefaultAccent - Whether using the default accent color
 * @returns {string} CSS class for text color
 */
export const getAccentTextColor = (isDarkMode, isDefaultAccent) => {
  if (isDarkMode && isDefaultAccent) {
    return "text-black"; // Use black text on light accent in dark mode
  }
  return "text-[var(--color-on-accent)]"; // Use light text on dark accent
};

/**
 * Determines the appropriate text color for accent backgrounds with opacity
 * @param {boolean} isDarkMode - Whether the app is in dark mode
 * @param {boolean} isDefaultAccent - Whether using the default accent color
 * @param {number} opacity - Opacity value (0-1)
 * @returns {string} CSS class for text color with opacity
 */
export const getAccentTextColorWithOpacity = (isDarkMode, isDefaultAccent, opacity = 0.8) => {
  if (isDarkMode && isDefaultAccent) {
    return `text-black/[${Math.round(opacity * 100)}]`; // Use black text with opacity
  }
  return `text-[var(--color-on-accent)]/[${Math.round(opacity * 100)}]`; // Use light text with opacity
};

/**
 * Determines the appropriate icon color for accent backgrounds
 * @param {boolean} isDarkMode - Whether the app is in dark mode
 * @param {boolean} isDefaultAccent - Whether using the default accent color
 * @returns {string} CSS class for icon color
 */
export const getAccentIconColor = (isDarkMode, isDefaultAccent) => {
  if (isDarkMode && isDefaultAccent) {
    return "text-black"; // Use black icons on light accent in dark mode
  }
  return "text-[var(--color-on-accent)]"; // Use light icons on dark accent
};
