/**
 * Utility functions for handling transaction categories
 */

/**
 * Formats a category key from Plaid format to display format.
 * "FOOD_AND_DRINK" → "Food and Drink"
 */
export function formatCategoryName(categoryKey: string | null | undefined): string {
  if (!categoryKey || typeof categoryKey !== 'string') {
    return 'Unknown Category';
  }

  const words = categoryKey.toLowerCase().split('_');

  const lowercaseWords = new Set([
    'and', 'or', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'the', 'a', 'an',
  ]);

  const formattedWords = words.map((word) => {
    if (lowercaseWords.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  return formattedWords.join(' ');
}

/**
 * Generates a unique hex color for a category group, biased toward the
 * predefined palette and falling back to a random color when exhausted.
 */
export function generateUniqueCategoryColor(existingColors: string[] = []): string {
  const colorPalette = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899',
    '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6', '#A855F7',
    '#DC2626', '#059669', '#D97706', '#7C3AED', '#BE185D', '#0D9488',
    '#CA8A04', '#9333EA', '#1D4ED8', '#16A34A', '#EA580C', '#7C2D12',
    '#365314', '#92400E', '#581C87', '#BE123C', '#0F766E', '#B45309',
    '#6B21A8',
  ];

  const existingColorsUpper = existingColors.map((color) =>
    color.toUpperCase().replace('#', '')
  );

  for (const color of colorPalette) {
    const colorUpper = color.toUpperCase().replace('#', '');
    if (!existingColorsUpper.includes(colorUpper)) {
      return color;
    }
  }

  const randomColor = Math.floor(Math.random() * 16777215).toString(16);
  return `#${randomColor.padStart(6, '0')}`;
}

export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function getContrastColor(hexColor: string): 'black' | 'white' {
  if (!isValidHexColor(hexColor)) {
    return 'black';
  }

  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? 'black' : 'white';
}

interface PlaidPersonalFinanceCategory {
  detailed?: string | null;
  primary?: string | null;
}

interface TransactionForCategoryDiscovery {
  personal_finance_category?: PlaidPersonalFinanceCategory | null;
}

interface CategoryGroupShape {
  id: string;
  name: string;
}

export interface NewSystemCategory {
  label: string;
  group_id: string;
}

/**
 * Identifies new system categories to be created from a list of transactions.
 * Deduplicates categories within the batch and checks against existing categories.
 */
export function getNewSystemCategories(
  transactions: TransactionForCategoryDiscovery[],
  existingSystemCategoryLabels: string[] = [],
  categoryGroups: CategoryGroupShape[] = []
): NewSystemCategory[] {
  const detailedCategoriesMap = new Map<string, string>();
  const categoryGroupMap = new Map<string, string>();

  categoryGroups.forEach((group) => {
    const primaryName = group.name.toUpperCase().replace(/\s+/g, '_');
    categoryGroupMap.set(primaryName, group.id);
  });

  transactions.forEach((transaction) => {
    const detailed = transaction.personal_finance_category?.detailed;
    const primary = transaction.personal_finance_category?.primary;
    if (detailed && primary && detailed.startsWith(primary + '_')) {
      const cleanedDetailed = detailed.substring(primary.length + 1);
      detailedCategoriesMap.set(cleanedDetailed, primary);
    }
  });

  const processedLabels = new Set(existingSystemCategoryLabels);
  const newSystemCategories: NewSystemCategory[] = [];

  for (const [detailed, primary] of detailedCategoriesMap) {
    const formattedLabel = formatCategoryName(detailed);
    const primaryName = primary.toUpperCase();
    const groupId = categoryGroupMap.get(primaryName);

    if (!processedLabels.has(formattedLabel) && groupId) {
      newSystemCategories.push({
        label: formattedLabel,
        group_id: groupId,
      });
      processedLabels.add(formattedLabel);
    }
  }

  return newSystemCategories;
}
