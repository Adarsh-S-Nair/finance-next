/**
 * Net-worth chart series engine.
 *
 * Produces a *fixed* number of evenly-spaced points for a given time range,
 * instead of one-point-per-day. Short ranges (1D/1W/1M) are reconstructed at
 * intraday resolution by pricing holdings over time; cash / credit / loans /
 * real estate step from daily snapshots (we have no intraday balance history,
 * so within a day they are flat). Long ranges (3M/YTD/1Y/ALL) use daily
 * holdings prices + daily snapshots, resampled to the same fixed point count.
 *
 * Everything here is pure and deterministic (caller passes `nowMs`), so the
 * range math, even spacing, as-of sampling and assembly are all unit-testable
 * without a database or network.
 */

export type NetWorthRange = '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | 'ALL';

export const NET_WORTH_RANGES: NetWorthRange[] = [
  '1D',
  '1W',
  '1M',
  '3M',
  'YTD',
  '1Y',
  'ALL',
];

const DAY_MS = 86_400_000;
const MAX_LOOKBACK_DAYS = 365;
/** Target points per range — fixed so every frame looks consistent. */
export const DEFAULT_POINTS = 80;

export interface RangePlan {
  range: NetWorthRange;
  startMs: number;
  endMs: number;
  points: number;
  /** Yahoo chart interval used to price holdings over this window. */
  yahooInterval: '5m' | '30m' | '60m' | '1d';
  /** Whether holdings are priced intraday (vs daily) for this range. */
  intraday: boolean;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Decide the window, point count and holdings-pricing granularity for a range.
 * The start is floored at the user's first connection so the line never
 * predates when they had any account (mirrors the by-date route's floor).
 */
export function planRange(
  range: NetWorthRange,
  nowMs: number,
  connectionMs?: number | null
): RangePlan {
  let startMs: number;
  let yahooInterval: RangePlan['yahooInterval'];
  let intraday = false;

  switch (range) {
    case '1D':
      startMs = nowMs - DAY_MS;
      yahooInterval = '5m';
      intraday = true;
      break;
    case '1W':
      startMs = nowMs - 7 * DAY_MS;
      yahooInterval = '30m';
      intraday = true;
      break;
    case '1M':
      startMs = nowMs - 30 * DAY_MS;
      yahooInterval = '60m';
      intraday = true;
      break;
    case '3M':
      startMs = nowMs - 90 * DAY_MS;
      yahooInterval = '1d';
      break;
    case 'YTD': {
      const d = new Date(nowMs);
      startMs = Date.UTC(d.getUTCFullYear(), 0, 1);
      yahooInterval = '1d';
      break;
    }
    case '1Y':
      startMs = nowMs - 365 * DAY_MS;
      yahooInterval = '1d';
      break;
    case 'ALL':
    default:
      startMs = nowMs - MAX_LOOKBACK_DAYS * DAY_MS;
      yahooInterval = '1d';
      break;
  }

  // Never start before the first account connection.
  if (connectionMs != null && connectionMs > startMs) {
    startMs = connectionMs;
  }
  // Guarantee a non-degenerate window even for brand-new accounts.
  if (startMs >= nowMs) {
    startMs = nowMs - DAY_MS;
  }

  return {
    range,
    startMs,
    endMs: nowMs,
    points: DEFAULT_POINTS,
    yahooInterval,
    intraday,
  };
}

/**
 * Produce `n` evenly-spaced timestamps spanning [startMs, endMs] inclusive.
 * The final timestamp is exactly endMs so callers can treat it as "now".
 */
export function evenTimestamps(startMs: number, endMs: number, n: number): number[] {
  if (n <= 1) return [endMs];
  if (endMs <= startMs) return [endMs];
  const step = (endMs - startMs) / (n - 1);
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(Math.round(startMs + step * i));
  out[n - 1] = endMs; // pin the last point exactly to now
  return out;
}

/**
 * Return the last item with `tMs <= t` (binary search over an ascending list).
 * If `t` precedes the first item, carry the first item back rather than
 * returning nothing — a balance/price before our earliest data point is best
 * estimated by the earliest one we have.
 */
export function asOf<T extends { tMs: number }>(sorted: T[], t: number): T | null {
  if (sorted.length === 0) return null;
  let lo = 0;
  let hi = sorted.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid].tMs <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans >= 0 ? sorted[ans] : sorted[0];
}

export interface AccountLite {
  id: string;
  isLiability: boolean;
  isInvestment: boolean;
  /** Live balance used for the final ("now") point. */
  currentBalance: number;
}

export interface SnapshotPoint {
  tMs: number;
  balance: number;
}

export interface HoldingLite {
  ticker: string;
  shares: number;
  isCash: boolean;
}

export interface PricePoint {
  tMs: number;
  price: number;
}

export interface AssembleParams {
  targets: number[];
  accounts: AccountLite[];
  /** Per-account daily snapshots, ascending by tMs. */
  snapshotsByAccount: Map<string, SnapshotPoint[]>;
  /** Per-account earliest known balance (carried back before first snapshot). */
  initialBalanceByAccount: Map<string, number>;
  /** Per-account holdings (only used for investment accounts). */
  holdingsByAccount: Map<string, HoldingLite[]>;
  /** Per-ticker price series, ascending by tMs. */
  priceSeries: Map<string, PricePoint[]>;
  /** Whether at least one ticker has a usable price series. */
  holdingsAvailable: boolean;
}

export interface NetWorthSeriesPoint {
  date: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  accountBalances: Record<string, number>;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Compute net worth at each target timestamp.
 *
 * - Investment accounts are valued from holdings × price-as-of-t when prices
 *   are available (the part that genuinely moves intraday).
 * - Every other account (and investment accounts when prices are unavailable)
 *   steps from its daily snapshots — flat between snapshot dates.
 * - The final point always uses live current balances so the chart's last
 *   value matches the headline net worth exactly.
 */
export function assembleNetWorthSeries(p: AssembleParams): NetWorthSeriesPoint[] {
  const series: NetWorthSeriesPoint[] = [];

  p.targets.forEach((t, i) => {
    const isLast = i === p.targets.length - 1;
    let assets = 0;
    let liabilities = 0;
    const accountBalances: Record<string, number> = {};

    for (const account of p.accounts) {
      const useHoldings = account.isInvestment && p.holdingsAvailable && !isLast;

      if (useHoldings) {
        let value = 0;
        const holdings = p.holdingsByAccount.get(account.id) || [];
        for (const h of holdings) {
          if (h.isCash) {
            value += h.shares;
            continue;
          }
          const ps = p.priceSeries.get(h.ticker);
          if (!ps) continue;
          const point = asOf(ps, t);
          if (point) value += h.shares * point.price;
        }
        assets += value;
        accountBalances[account.id] = round2(value);
        continue;
      }

      let balance: number;
      if (isLast) {
        balance = account.currentBalance;
      } else {
        const snap = asOf(p.snapshotsByAccount.get(account.id) || [], t);
        balance = snap ? snap.balance : p.initialBalanceByAccount.get(account.id) ?? 0;
      }

      if (account.isLiability) {
        liabilities += Math.abs(balance);
        accountBalances[account.id] = -Math.abs(balance);
      } else {
        assets += balance;
        accountBalances[account.id] = round2(balance);
      }
    }

    series.push({
      date: new Date(t).toISOString(),
      netWorth: round2(assets - liabilities),
      assets: round2(assets),
      liabilities: round2(liabilities),
      accountBalances,
    });
  });

  return series;
}

export { toNumber as _toNumber };
