/**
 * Pure helpers for deciding how far back the net-worth chart should extend.
 *
 * The /api/net-worth/by-date route reconstructs daily net worth. For users who
 * hold investments it prices their *current* holdings backwards across the
 * whole window — which, left unbounded, draws a full year of history even for
 * dates before the user had any account. We floor the start at the user's
 * first account connection so the chart never predates when they started.
 */

export function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export interface ChartStartParams {
  /** Today as an ISO date string (YYYY-MM-DD). */
  todayISO: string;
  /** Lookback cap in days (already clamped to <= 365 by the caller). */
  maxDays: number;
  /** Whether the user has priceable holdings (drives the reconstruction path). */
  hasHoldings: boolean;
  /** Earliest account_snapshot date, or today if there are none. */
  earliestSnapshotISO: string;
  /** Earliest account creation date across scope, or null if unknown. */
  earliestConnectionISO: string | null;
}

/**
 * Resolve the earliest date the chart should display, as an ISO date string.
 *
 * Rules:
 *  - Never earlier than the lookback window (today - (maxDays - 1)).
 *  - Never earlier than the user's first account connection.
 *  - With holdings: start at that floor (reconstruct from there forward).
 *  - Without holdings: start at the first snapshot, but not before the floor.
 *
 * ISO date strings (YYYY-MM-DD) compare lexically in chronological order, so
 * string comparison is used directly.
 */
export function resolveChartStartISO(p: ChartStartParams): string {
  const lookbackStart = new Date(p.todayISO);
  lookbackStart.setDate(lookbackStart.getDate() - (p.maxDays - 1));
  let floorISO = toISODateString(lookbackStart);

  if (p.earliestConnectionISO && p.earliestConnectionISO > floorISO) {
    floorISO = p.earliestConnectionISO;
  }

  if (p.hasHoldings) return floorISO;
  return p.earliestSnapshotISO > floorISO ? p.earliestSnapshotISO : floorISO;
}
