/**
 * Pure display logic for the recurring streams view. No IO — everything
 * here is unit-testable with plain fixtures, matching the repo's
 * logic-level testing convention (see lib/plaid/recurringSync).
 */

export interface RecurringStream {
  stream_id: string;
  stream_type: "inflow" | "outflow";
  description: string | null;
  merchant_name: string | null;
  frequency: string | null;
  predicted_next_date: string | null;
  average_amount: number; // absolute-valued at sync time (buildRecord.ts)
  last_amount: number;
  is_active: boolean | null;
  icon_url?: string | null;
  category_hex_color?: string | null;
}

/** Plaid frequency → approximate occurrences per month. */
const MONTHLY_MULTIPLIER: Record<string, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMI_MONTHLY: 2,
  MONTHLY: 1,
  ANNUALLY: 1 / 12,
};

export const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  SEMI_MONTHLY: "Twice a month",
  MONTHLY: "Monthly",
  ANNUALLY: "Yearly",
  UNKNOWN: "Irregular",
};

export function frequencyLabel(frequency: string | null): string {
  if (!frequency) return FREQUENCY_LABEL.UNKNOWN;
  return FREQUENCY_LABEL[frequency] ?? FREQUENCY_LABEL.UNKNOWN;
}

/**
 * Normalize a stream's average amount to a per-month figure. Unknown or
 * irregular frequencies count at face value once a month — better to
 * slightly overstate than to silently drop a detected bill.
 */
export function monthlyAmount(stream: Pick<RecurringStream, "frequency" | "average_amount">): number {
  const multiplier = MONTHLY_MULTIPLIER[stream.frequency ?? ""] ?? 1;
  return stream.average_amount * multiplier;
}

export function estimatedMonthlyTotal(streams: RecurringStream[]): number {
  return streams.reduce((sum, s) => sum + monthlyAmount(s), 0);
}

export function streamName(stream: Pick<RecurringStream, "merchant_name" | "description">): string {
  return stream.merchant_name || stream.description || "Unknown";
}

/**
 * Split into outflows (subscriptions & bills) and inflows (recurring
 * income), each sorted soonest-next-charge first with undated streams
 * last.
 */
export function splitStreams(streams: RecurringStream[]): {
  outflows: RecurringStream[];
  inflows: RecurringStream[];
} {
  const byNextDate = (a: RecurringStream, b: RecurringStream) => {
    if (!a.predicted_next_date && !b.predicted_next_date) return 0;
    if (!a.predicted_next_date) return 1;
    if (!b.predicted_next_date) return -1;
    return a.predicted_next_date.localeCompare(b.predicted_next_date);
  };
  return {
    outflows: streams.filter((s) => s.stream_type === "outflow").sort(byNextDate),
    inflows: streams.filter((s) => s.stream_type === "inflow").sort(byNextDate),
  };
}

/**
 * Human label for the predicted next charge date, relative to `now`.
 * Dates are YYYY-MM-DD strings compared in local time at day
 * granularity. Past predictions read as "Due" rather than a negative
 * day count — Plaid's prediction lags briefly after a charge posts.
 */
export function nextDateLabel(predictedNextDate: string | null, now: Date): string {
  if (!predictedNextDate) return "—";
  const [y, m, d] = predictedNextDate.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const next = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "Due";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 30) return `In ${days} days`;
  return next.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
