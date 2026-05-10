import type { InsightCandidate } from '../types';
import { formatCurrency } from '../../formatCurrency';

interface RecurringStream {
  stream_type: string;
  predicted_next_date: string | null;
  average_amount: number | null;
  merchant_name: string | null;
}

/**
 * Bills predicted in the next 7 days. The candidate carries the full
 * top-N list so the curator can name a specific merchant in its
 * rewrite ("$2,400 in bills this week, mostly the LoanDepot mortgage")
 * instead of just quoting the count.
 */
export function upcomingBillsCandidates(streams: RecurringStream[]): InsightCandidate[] {
  if (!streams || streams.length === 0) return [];

  const now = new Date();
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const todayStr = now.toISOString().slice(0, 10);
  const weekStr = weekFromNow.toISOString().slice(0, 10);

  const upcoming = streams.filter((s) => {
    if (s.stream_type !== 'outflow') return false;
    if (!s.predicted_next_date) return false;
    return s.predicted_next_date >= todayStr && s.predicted_next_date <= weekStr;
  });

  if (upcoming.length === 0) return [];

  const total = upcoming.reduce((sum, s) => sum + Math.abs(s.average_amount || 0), 0);
  const formatted = formatCurrency(total);
  const count = upcoming.length;
  const billWord = count === 1 ? 'bill' : 'bills';

  // Top 5 by amount, normalized for the curator's narration.
  const topItems = [...upcoming]
    .map((s) => ({
      merchant_name: s.merchant_name || 'Unknown',
      amount: Math.abs(s.average_amount || 0),
      due_date: s.predicted_next_date as string,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return [
    {
      id: 'upcoming-bills',
      kind: 'upcoming_bills',
      defaultTitle: 'Upcoming Bills',
      defaultMessage: `${count} ${billWord} totaling ${formatted} due this week.`,
      defaultTone: 'neutral',
      priorityHint: 3,
      feature: 'recurring',
      context: {
        type: 'upcoming_bills',
        count,
        total,
        top_items: topItems,
      },
    },
  ];
}
