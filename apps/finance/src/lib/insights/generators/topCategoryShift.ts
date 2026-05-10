import type { InsightCandidate } from '../types';
import { formatNumber } from '../types';

interface CategoryData {
  label: string;
  total_spent: number;
}

interface MonthData {
  spending: number;
  isCurrentMonth: boolean;
  isComplete: boolean;
}

interface TopCategoryShiftData {
  categories: CategoryData[];
  months: MonthData[];
}

/**
 * Surfaces the top-spending category this month if it's notably above
 * the user's typical per-category average. Emits up to one candidate;
 * the curator decides if "X is high this month" beats "Y bills are
 * upcoming" in importance.
 */
export function topCategoryShiftCandidates(data: TopCategoryShiftData): InsightCandidate[] {
  const { categories, months } = data;

  if (!categories || categories.length === 0) return [];

  const priorMonths = months.filter((m) => !m.isCurrentMonth && m.isComplete);
  if (priorMonths.length < 2) return [];

  const avgMonthlySpending = priorMonths.reduce((s, m) => s + m.spending, 0) / priorMonths.length;
  if (avgMonthlySpending === 0) return [];

  const avgPerCategory = avgMonthlySpending / Math.max(categories.length, 1);
  const topCategory = categories[0];

  if (!topCategory || topCategory.total_spent === 0) return [];

  const ratio = topCategory.total_spent / avgPerCategory;
  // Lower the floor to 1.2x — let the curator decide if 30% above
  // typical is interesting given the absolute dollars and the user's
  // budget for this category.
  if (ratio < 1.2) return [];

  const pct = Math.round((ratio - 1) * 100);

  return [
    {
      id: `category-shift:${topCategory.label}`,
      kind: 'category_shift',
      defaultTitle: topCategory.label,
      defaultMessage: `${topCategory.label} spending is ${formatNumber(pct)}% higher than your typical month.`,
      defaultTone: 'negative',
      priorityHint: 4,
      context: {
        type: 'category_shift',
        category_label: topCategory.label,
        current_month_spent: topCategory.total_spent,
        typical_per_category_avg: avgPerCategory,
        ratio,
        pct_above_typical: pct,
      },
    },
  ];
}
