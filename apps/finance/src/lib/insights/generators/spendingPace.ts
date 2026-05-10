import type { InsightCandidate } from '../types';
import { formatNumber } from '../types';

interface SpendingPaceData {
  currentMonthSpending: number;
  lastMonthSpending: number;
}

/**
 * Compares same-day-of-month spending vs last month. Emits a single
 * candidate when there's a meaningful change. The curator decides
 * whether the magnitude is interesting given the user's context (a
 * 6% swing is different in a $500/month vs $5,000/month spender).
 */
export function spendingPaceCandidates(data: SpendingPaceData): InsightCandidate[] {
  const { currentMonthSpending, lastMonthSpending } = data;

  if (lastMonthSpending === 0 && currentMonthSpending === 0) return [];
  if (lastMonthSpending === 0) return [];

  const change = ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100;
  const absChange = Math.abs(Math.round(change));

  // Floor at 5% — anything tighter than that is statistical noise on a
  // partial month. The curator may further filter based on absolute
  // magnitude in the user's context.
  if (absChange < 5) return [];

  const now = new Date();
  const daysIntoMonth = now.getDate();

  return [
    {
      id: 'spending-pace',
      kind: 'spending_pace',
      defaultTitle: 'Spending Pace',
      defaultMessage:
        change < 0
          ? `You're spending ${formatNumber(absChange)}% less than this point last month. Nice.`
          : `You're spending ${formatNumber(absChange)}% faster than this point last month.`,
      defaultTone: change < 0 ? 'positive' : 'negative',
      priorityHint: 2,
      context: {
        type: 'spending_pace',
        current_month_spending: currentMonthSpending,
        last_month_spending: lastMonthSpending,
        pct_change: Math.round(change),
        days_into_month: daysIntoMonth,
      },
    },
  ];
}
