import type { Insight } from '../types';
import { formatCurrency } from '../../formatCurrency';

interface RecurringStream {
  stream_type: string;
  predicted_next_date: string | null;
  average_amount: number | null;
  merchant_name: string | null;
}

export function upcomingBills(streams: RecurringStream[]): Insight | null {
  if (!streams || streams.length === 0) return null;

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

  if (upcoming.length === 0) return null;

  const total = upcoming.reduce((sum, s) => sum + Math.abs(s.average_amount || 0), 0);
  const formatted = formatCurrency(total);

  const count = upcoming.length;
  const billWord = count === 1 ? 'bill' : 'bills';

  return {
    id: 'upcoming-bills',
    title: 'Upcoming Bills',
    priority: 3,
    message: `${count} ${billWord} totaling ${formatted} due this week.`,
    tone: 'neutral',
    feature: 'recurring',
  };
}
