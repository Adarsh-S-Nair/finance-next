import type { Insight } from '../types';

interface SpendingPaceData {
  currentMonthSpending: number;
  lastMonthSpending: number;
}

export function spendingPace(data: SpendingPaceData): Insight | null {
  const { currentMonthSpending, lastMonthSpending } = data;

  if (lastMonthSpending === 0 && currentMonthSpending === 0) return null;
  if (lastMonthSpending === 0) return null;

  const change = ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100;
  const absChange = Math.abs(Math.round(change));

  if (absChange < 5) return null;

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(currentMonthSpending);

  if (change < 0) {
    return {
      id: 'spending-pace',
      priority: 2,
      message: `You've spent ${formatted} this month — ${absChange}% less than this point last month.`,
      tone: 'positive',
    };
  }

  return {
    id: 'spending-pace',
    priority: 2,
    message: `You've spent ${formatted} this month — ${absChange}% more than this point last month.`,
    tone: 'negative',
  };
}
