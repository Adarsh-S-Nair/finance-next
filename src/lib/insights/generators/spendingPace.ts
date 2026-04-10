import type { Insight } from '../types';
import { formatNumber } from '../types';

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

  if (change < 0) {
    return {
      id: 'spending-pace',
      title: 'Spending Pace',
      priority: 2,
      message: `You're spending ${formatNumber(absChange)}% less than this point last month. Nice.`,
      tone: 'positive',
    };
  }

  return {
    id: 'spending-pace',
    title: 'Spending Pace',
    priority: 2,
    message: `You're spending ${formatNumber(absChange)}% faster than this point last month.`,
    tone: 'negative',
  };
}
