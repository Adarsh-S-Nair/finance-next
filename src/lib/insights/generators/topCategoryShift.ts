import type { Insight } from '../types';
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

export function topCategoryShift(data: TopCategoryShiftData): Insight | null {
  const { categories, months } = data;

  if (!categories || categories.length === 0) return null;

  const priorMonths = months.filter((m) => !m.isCurrentMonth && m.isComplete);
  if (priorMonths.length < 2) return null;

  const avgMonthlySpending = priorMonths.reduce((s, m) => s + m.spending, 0) / priorMonths.length;
  if (avgMonthlySpending === 0) return null;

  const avgPerCategory = avgMonthlySpending / Math.max(categories.length, 1);
  const topCategory = categories[0];

  if (!topCategory || topCategory.total_spent === 0) return null;

  const ratio = topCategory.total_spent / avgPerCategory;
  if (ratio < 1.4) return null;

  const pct = Math.round((ratio - 1) * 100);

  return {
    id: 'top-category-shift',
    title: topCategory.label,
    priority: 4,
    message: `${topCategory.label} spending is ${formatNumber(pct)}% higher than your typical month.`,
    tone: 'negative',
  };
}
