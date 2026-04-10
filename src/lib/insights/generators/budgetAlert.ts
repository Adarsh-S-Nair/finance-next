import type { Insight } from '../types';
import { formatNumber } from '../types';

interface BudgetProgress {
  amount: number;
  spent: number;
  remaining: number;
  percentage: number;
  category_groups?: { name: string } | null;
  system_categories?: { label: string } | null;
}

export function budgetAlert(budgets: BudgetProgress[]): Insight | null {
  if (!budgets || budgets.length === 0) return null;

  const highest = budgets.reduce((max, b) => (b.percentage > max.percentage ? b : max), budgets[0]);
  if (highest.percentage < 75) return null;

  const name = highest.category_groups?.name || highest.system_categories?.label || 'A budget';

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = daysInMonth - now.getDate();
  const daysLabel = daysLeft === 1 ? '1 day' : `${daysLeft} days`;

  const pct = Math.round(highest.percentage);

  return {
    id: 'budget-alert',
    title: `${name} Budget`,
    priority: 1,
    message: `Your ${name} budget is ${formatNumber(pct)}% spent with ${daysLabel} left this month.`,
    tone: pct >= 90 ? 'negative' : 'neutral',
    feature: 'budgets',
  };
}
