import { format, startOfMonth, subMonths } from "date-fns";

/** A transaction reduced to what the spending calc needs. */
export interface SpendingTxn {
  date: string; // yyyy-MM-dd
  amount: number; // negative = outflow
  primary: string | null; // Plaid personal_finance_category primary
}

// Categories that move the user's own money rather than represent real
// spending — excluded when sizing the cash buffer.
const NON_SPENDING_PRIMARIES = new Set(["TRANSFER_IN", "TRANSFER_OUT"]);

/** yyyy-MM keys for the `count` most recent complete months before `now`. */
export function recentCompleteMonths(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = 1; i <= count; i++) {
    keys.push(format(subMonths(startOfMonth(now), i), "yyyy-MM"));
  }
  return keys;
}

/**
 * Median monthly spending across the given months — outflows only,
 * internal transfers excluded. We use the median, not the mean, so a
 * single outlier month (one large one-off payment) doesn't distort the
 * buffer: e.g. months of [$1,870, $8,747, $23,581] give $8,747, not the
 * mean of $11,399 that the April spike inflates.
 *
 * Months with no spending count as $0 (the keys are pre-seeded), so the
 * median is always taken over exactly `monthKeys.length` values.
 */
export function medianMonthlySpending(
  txns: SpendingTxn[],
  monthKeys: string[],
): number {
  const totals = new Map<string, number>();
  for (const k of monthKeys) totals.set(k, 0);

  for (const t of txns) {
    if (!(t.amount < 0)) continue;
    if (NON_SPENDING_PRIMARIES.has(t.primary ?? "")) continue;
    const key = t.date.slice(0, 7);
    if (!totals.has(key)) continue;
    totals.set(key, (totals.get(key) ?? 0) + Math.abs(t.amount));
  }

  const sorted = [...totals.values()].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(median);
}
