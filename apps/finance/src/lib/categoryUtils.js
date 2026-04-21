/**
 * Utility functions for handling transaction categories
 */

/**
 * Formats a category key from Plaid format to display format
 * Converts "FOOD_AND_DRINK" to "Food and Drink"
 * @param {string} categoryKey - The category key from Plaid (e.g., "FOOD_AND_DRINK")
 * @returns {string} - Formatted category name (e.g., "Food and Drink")
 */
export function formatCategoryName(categoryKey) {
  if (!categoryKey || typeof categoryKey !== 'string') {
    return 'Unknown Category';
  }

  // Replace underscores with spaces and convert to lowercase
  const words = categoryKey.toLowerCase().split('_');

  // Words that should remain lowercase (conjunctions, prepositions, etc.)
  const lowercaseWords = new Set([
    'and', 'or', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'the', 'a', 'an'
  ]);

  // Capitalize each word except conjunctions
  const formattedWords = words.map(word => {
    if (lowercaseWords.has(word)) {
      return word;
    }
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  return formattedWords.join(' ');
}

/**
 * Generates a unique hex color for a category group
 * Ensures the color is distinct from existing category group colors
 * @param {Array} existingColors - Array of existing hex colors
 * @returns {string} - A unique hex color
 */
export function generateUniqueCategoryColor(existingColors = []) {
  // Predefined color palette for category groups
  const colorPalette = [
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#10B981', // Green
    '#F59E0B', // Yellow
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#A855F7', // Violet
    '#DC2626', // Red-600
    '#059669', // Green-600
    '#D97706', // Orange-600
    '#7C3AED', // Violet-600
    '#BE185D', // Pink-600
    '#0D9488', // Teal-600
    '#CA8A04', // Yellow-600
    '#9333EA', // Purple-600
    '#1D4ED8', // Blue-600
    '#16A34A', // Green-500
    '#EA580C', // Orange-500
    '#7C2D12', // Red-800
    '#365314', // Green-800
    '#92400E', // Yellow-800
    '#581C87', // Purple-800
    '#BE123C', // Rose-600
    '#0F766E', // Teal-700
    '#B45309', // Amber-600
    '#6B21A8', // Purple-700
  ];

  // Convert existing colors to uppercase for comparison
  const existingColorsUpper = existingColors.map(color =>
    color.toUpperCase().replace('#', '')
  );

  // Find the first color that's not already used
  for (const color of colorPalette) {
    const colorUpper = color.toUpperCase().replace('#', '');
    if (!existingColorsUpper.includes(colorUpper)) {
      return color;
    }
  }

  // If all colors are used, generate a random one
  // This is unlikely to happen with the current palette size
  const randomColor = Math.floor(Math.random() * 16777215).toString(16);
  return `#${randomColor.padStart(6, '0')}`;
}

/**
 * Validates if a string is a valid hex color
 * @param {string} color - The color string to validate
 * @returns {boolean} - True if valid hex color
 */
export function isValidHexColor(color) {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Gets the contrast color (black or white) for a given background color
 * @param {string} hexColor - The background hex color
 * @returns {string} - Either 'black' or 'white' for optimal contrast
 */
export function getContrastColor(hexColor) {
  if (!isValidHexColor(hexColor)) {
    return 'black';
  }

  // Remove the # and convert to RGB
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black for light colors, white for dark colors
  return luminance > 0.5 ? 'black' : 'white';
}

/**
 * Identifies new system categories to be created from a list of transactions.
 * Deduplicates categories within the batch and checks against existing categories.
 * 
 * @param {Array} transactions - List of transaction objects
 * @param {Array<string>} existingSystemCategoryLabels - List of existing system category labels
 * @param {Array} categoryGroups - List of category group objects {id, name}
 * @returns {Array} - List of new system categories to insert {label, group_id}
 */
export function getNewSystemCategories(transactions, existingSystemCategoryLabels = [], categoryGroups = []) {
  // Use a Map to ensure uniqueness by detailed label (key) -> primary category (value)
  const detailedCategoriesMap = new Map();
  const categoryGroupMap = new Map(); // Map primary category to category group ID

  // Build mapping from primary category name to category group ID
  categoryGroups.forEach(group => {
    const primaryName = group.name.toUpperCase().replace(/\s+/g, '_');
    categoryGroupMap.set(primaryName, group.id);
  });

  // Extract unique detailed categories from transactions
  transactions.forEach(transaction => {
    if (transaction.personal_finance_category?.detailed && transaction.personal_finance_category?.primary) {
      const detailed = transaction.personal_finance_category.detailed;
      const primary = transaction.personal_finance_category.primary;

      // Remove the primary key from the beginning of detailed string
      if (detailed.startsWith(primary + '_')) {
        const cleanedDetailed = detailed.substring(primary.length + 1); // +1 for the underscore
        // Only add if not already present (Map handles this automatically by key)
        detailedCategoriesMap.set(cleanedDetailed, primary);
      }
    }
  });

  // Track processed labels to prevent duplicates within the batch (initialized with existing)
  const processedLabels = new Set(existingSystemCategoryLabels);
  const newSystemCategories = [];

  for (const [detailed, primary] of detailedCategoriesMap) {
    const formattedLabel = formatCategoryName(detailed);
    const primaryName = primary.toUpperCase();
    const groupId = categoryGroupMap.get(primaryName);

    if (!processedLabels.has(formattedLabel) && groupId) {
      newSystemCategories.push({
        label: formattedLabel,
        group_id: groupId
      });
      processedLabels.add(formattedLabel); // Mark as processed for this batch
    }
  }

  return newSystemCategories;
}
