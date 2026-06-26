/**
 * Deterministic income detection.
 *
 * Plaid's own recurring-stream detection is unreliable for income: it
 * routinely misses real payroll, and what it does surface is polluted by
 * internal account transfers, equity sales, and tax refunds — all of which
 * look like "money in". This module ignores Plaid's streams entirely and
 * works straight from the transaction ledger, where the actual paychecks
 * live tagged `INCOME_SALARY` / `INCOME_WAGES`.
 *
 * The hard part is that the same employer shows up under several labels
 * ("Direct deposit from 100-SFDC INC.", "From 100-SFDC INC.", "Inc.") and
 * the amount drifts (raises, the odd bonus). So we cluster by deposit
 * *account + cadence* rather than by label string, take a robust median of
 * recent deposits for the expected amount, and require a regular series
 * before we'll call something a paycheck. A lone off-cadence deposit (a
 * state tax refund miscategorised as salary, say) never becomes a stream.
 *
 * Everything here is pure so it can be unit-tested against real fixtures.
 * The runner does the IO (load transactions) and persistence.
 */

export type Cadence =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'SEMIMONTHLY'
  | 'MONTHLY'
  | 'IRREGULAR';

export type IncomeKind = 'paycheck' | 'interest' | 'dividend' | 'other';

/** A single inflow transaction. Amounts are positive (money in). */
export interface IncomeTxn {
  date: string; // yyyy-MM-dd
  amount: number; // positive = inflow
  merchant_name: string | null;
  description: string | null;
  category_primary: string | null; // Plaid PFC primary
  category_detailed: string | null; // Plaid PFC detailed
  account_id: string;
}

export interface IncomeStream {
  /** Stable key (account + kind) so the same series matches across sweeps. */
  key: string;
  /** Human label, best-effort from the deposits' descriptions. */
  label: string;
  kind: IncomeKind;
  cadence: Cadence;
  /** Typical recent deposit — median of the most recent few, so a raise or
   *  one-off bonus doesn't skew it. This is the "how much" the card shows. */
  expectedAmount: number;
  lastAmount: number;
  lastDate: string;
  /** Predicted next deposit, rolled forward past `now`. Null if cadence is
   *  too irregular to project. */
  nextDate: string | null;
  /** Deposit amount normalised to a monthly figure, for income totals. */
  monthlyEquivalent: number;
  /** 0..1 — how regular/confident this series is. */
  confidence: number;
  /** The deposits backing this stream (one entry per pay date). */
  deposits: { date: string; amount: number }[];
}

export interface IncomeProfile {
  /** The main paycheck — highest-value regular wage stream, or null. */
  primary: IncomeStream | null;
  /** Every recurring income stream we detected (includes `primary`). */
  streams: IncomeStream[];
  /** Sum of monthly-equivalent across all streams. */
  monthlyIncome: number;
  /** What we deliberately left out, for transparency / debugging. */
  excluded: {
    transfers: number;
    oneOffs: { label: string; amount: number; date: string }[];
  };
}

// --- date helpers (UTC-noon to dodge DST/parse edge cases) ---------------

function parseDay(d: string): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day, 12);
}

function toDay(ms: number): string {
  const dt = new Date(ms);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// --- classification ------------------------------------------------------

const WAGE_DETAILED = new Set(['INCOME_WAGES', 'INCOME_SALARY']);
// Income that recurs but isn't a paycheck — still counts toward monthly
// income, never treated as "your paycheck".
const KIND_BY_DETAILED: Record<string, IncomeKind> = {
  INCOME_WAGES: 'paycheck',
  INCOME_SALARY: 'paycheck',
  INCOME_INTEREST_EARNED: 'interest',
  INCOME_DIVIDENDS: 'dividend',
  INCOME_RETIREMENT_PENSION: 'other',
  INCOME_UNEMPLOYMENT: 'other',
  INCOME_OTHER_INCOME: 'other',
};
// Income categories that are inherently one-off / lumpy — excluded from
// recurring-stream detection so a big tax refund never reads as salary.
const ONE_OFF_DETAILED = new Set(['INCOME_TAX_REFUND']);

function isIncome(t: IncomeTxn): boolean {
  return t.category_primary === 'INCOME';
}

/** Map a deposit's `detailed` category to its income kind, or null if it
 *  isn't recurring income we model (transfers, tax refunds, etc.). */
function incomeKind(t: IncomeTxn): IncomeKind | null {
  if (!isIncome(t)) return null;
  const detailed = t.category_detailed ?? '';
  if (ONE_OFF_DETAILED.has(detailed)) return null;
  return KIND_BY_DETAILED[detailed] ?? 'other';
}

// --- cadence -------------------------------------------------------------

/** Bucket a median gap (in days) into a named cadence. The bands overlap
 *  reality a little (biweekly ≈ 14d, semi-monthly ≈ 15.2d) so we split at
 *  ~14.5 and lean on the surrounding bands. */
export function cadenceFromGap(gapDays: number): Cadence {
  if (gapDays <= 0) return 'IRREGULAR';
  if (gapDays <= 10) return 'WEEKLY';
  if (gapDays < 14.5) return 'BIWEEKLY';
  if (gapDays <= 18) return 'SEMIMONTHLY';
  if (gapDays <= 45) return 'MONTHLY';
  return 'IRREGULAR';
}

function monthlyMultiplier(cadence: Cadence): number {
  switch (cadence) {
    case 'WEEKLY':
      return 52 / 12;
    case 'BIWEEKLY':
      return 26 / 12;
    case 'SEMIMONTHLY':
      return 2;
    case 'MONTHLY':
      return 1;
    default:
      return 0; // handled separately for IRREGULAR
  }
}

/** Step a date forward by a cadence. Used to roll a stale predicted date
 *  into the future. */
function advance(dayMs: number, cadence: Cadence, gapDays: number): number {
  const step =
    cadence === 'WEEKLY'
      ? 7
      : cadence === 'BIWEEKLY'
        ? 14
        : cadence === 'SEMIMONTHLY'
          ? 15
          : cadence === 'MONTHLY'
            ? 30
            : Math.round(gapDays) || 30;
  return dayMs + step * DAY_MS;
}

// --- stream building -----------------------------------------------------

/** Collapse deposits that land on the same day into one pay event (a
 *  paycheck split across two lines, or a same-day bonus). Summed. */
function collapseSameDay(
  deposits: { date: string; amount: number }[],
): { date: string; amount: number }[] {
  const byDate = new Map<string, number>();
  for (const d of deposits) {
    byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.amount);
  }
  return [...byDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => parseDay(a.date) - parseDay(b.date));
}

/** Pick the most descriptive label across a cluster's deposits. Longer
 *  strings carry more signal ("Direct deposit from 100-SFDC INC." beats the
 *  truncated "Inc."), so we take the longest distinct label. */
function bestLabel(txns: IncomeTxn[]): string {
  const labels = txns
    .map((t) => (t.merchant_name || t.description || '').trim())
    .filter(Boolean);
  if (labels.length === 0) return 'Income';
  return labels.sort((a, b) => b.length - a.length)[0];
}

const MIN_PAYCHECK_DEPOSITS = 3; // a series, not a one-off
const MIN_OTHER_DEPOSITS = 2; // interest/dividends recur faster to confirm

function buildStream(
  key: string,
  kind: IncomeKind,
  txns: IncomeTxn[],
  now: Date,
): IncomeStream | null {
  const events = collapseSameDay(
    txns.map((t) => ({ date: t.date, amount: t.amount })),
  );
  const minDeposits = kind === 'paycheck' ? MIN_PAYCHECK_DEPOSITS : MIN_OTHER_DEPOSITS;
  if (events.length < minDeposits) return null;

  // Gaps between consecutive pay events.
  const gaps: number[] = [];
  for (let i = 1; i < events.length; i++) {
    gaps.push((parseDay(events[i].date) - parseDay(events[i - 1].date)) / DAY_MS);
  }
  const medGap = median(gaps);
  const cadence = cadenceFromGap(medGap);

  // Expected amount: median of the most recent few deposits, so a raise
  // (older, smaller paychecks) or a one-off bonus doesn't drag it.
  const recent = events.slice(-4);
  const expectedAmount = Math.round(median(recent.map((e) => e.amount)) * 100) / 100;

  const last = events[events.length - 1];

  // Next date: roll the last pay date forward by cadence until it's in the
  // future. Null if cadence is too irregular to trust.
  let nextDate: string | null = null;
  if (cadence !== 'IRREGULAR') {
    const todayMs = parseDay(toDay(now.getTime()));
    let nextMs = parseDay(last.date);
    let guard = 0;
    while (nextMs < todayMs && guard < 400) {
      nextMs = advance(nextMs, cadence, medGap);
      guard++;
    }
    nextDate = toDay(nextMs);
  }

  // Monthly-equivalent for income totals. Irregular streams fall back to
  // observed total over the months they span.
  let monthlyEquivalent: number;
  if (cadence === 'IRREGULAR') {
    const spanDays =
      (parseDay(last.date) - parseDay(events[0].date)) / DAY_MS || 30;
    const months = Math.max(spanDays / 30, 1);
    const total = events.reduce((s, e) => s + e.amount, 0);
    monthlyEquivalent = Math.round((total / months) * 100) / 100;
  } else {
    monthlyEquivalent =
      Math.round(expectedAmount * monthlyMultiplier(cadence) * 100) / 100;
  }

  // Confidence: more deposits + more regular gaps = higher. Gap regularity
  // is 1 minus the coefficient of variation of the gaps.
  const gapCv =
    medGap > 0 && gaps.length > 0
      ? Math.sqrt(
          gaps.reduce((s, g) => s + (g - medGap) ** 2, 0) / gaps.length,
        ) / medGap
      : 1;
  const regularity = Math.max(0, 1 - gapCv);
  const countFactor = Math.min(1, events.length / 4);
  const confidence =
    cadence === 'IRREGULAR'
      ? Math.min(0.4, regularity * countFactor)
      : Math.round((0.5 * regularity + 0.5 * countFactor) * 100) / 100;

  return {
    key,
    label: bestLabel(txns),
    kind,
    cadence,
    expectedAmount,
    lastAmount: last.amount,
    lastDate: last.date,
    nextDate,
    monthlyEquivalent,
    confidence,
    deposits: events,
  };
}

/**
 * Detect a user's income from their inflow transactions.
 *
 * @param txns  All positive-amount transactions (any window; ~6–12 months
 *              gives the cleanest cadence read). Outflows are ignored.
 * @param now   "Today", injected for deterministic next-date prediction.
 */
export function detectIncome(txns: IncomeTxn[], now: Date): IncomeProfile {
  let transfers = 0;
  const candidates: { kind: IncomeKind; txn: IncomeTxn }[] = [];
  const oneOffPool: IncomeTxn[] = [];

  for (const t of txns) {
    if (t.amount <= 0) continue;
    if (t.category_primary === 'TRANSFER_IN') {
      transfers++;
      continue;
    }
    const kind = incomeKind(t);
    if (kind === null) {
      // Income-but-one-off (tax refund) or non-income inflow (equity sale
      // with a null category). Track INCOME ones as one-offs for display.
      if (isIncome(t)) oneOffPool.push(t);
      continue;
    }
    candidates.push({ kind, txn: t });
  }

  // Cluster by deposit account + kind. Account is the stable axis: an
  // employer's variable labels all hit the same account, while an off-band
  // deposit (different account, e.g. a refund) clusters separately and
  // fails the min-deposits bar.
  const clusters = new Map<string, { kind: IncomeKind; txns: IncomeTxn[] }>();
  for (const { kind, txn } of candidates) {
    const key = `${txn.account_id}:${kind}`;
    if (!clusters.has(key)) clusters.set(key, { kind, txns: [] });
    clusters.get(key)!.txns.push(txn);
  }

  const streams: IncomeStream[] = [];
  const usedTxnDates = new Set<string>();
  for (const [key, { kind, txns: clusterTxns }] of clusters) {
    const stream = buildStream(key, kind, clusterTxns, now);
    if (stream) {
      streams.push(stream);
      for (const e of stream.deposits) usedTxnDates.add(`${key}:${e.date}`);
    } else {
      // Didn't form a series — surface the deposits as one-offs.
      for (const t of clusterTxns) oneOffPool.push(t);
    }
  }

  streams.sort((a, b) => b.monthlyEquivalent - a.monthlyEquivalent);

  const primary =
    streams.find((s) => s.kind === 'paycheck') ?? null;

  const monthlyIncome =
    Math.round(streams.reduce((s, st) => s + st.monthlyEquivalent, 0) * 100) /
    100;

  const oneOffs = oneOffPool
    .map((t) => ({
      label: (t.merchant_name || t.description || 'Income').trim(),
      amount: t.amount,
      date: t.date,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    primary,
    streams,
    monthlyIncome,
    excluded: { transfers, oneOffs },
  };
}

/** Anomaly check on the most recent paycheck vs the stream's expected
 *  amount. Returns null when there's nothing notable. `threshold` is the
 *  fractional deviation that counts as an anomaly (0.15 = 15%). */
export function paycheckAnomaly(
  stream: IncomeStream,
  threshold = 0.15,
): { direction: 'higher' | 'lower'; pct: number; expected: number; actual: number } | null {
  if (stream.expectedAmount <= 0) return null;
  const diff = stream.lastAmount - stream.expectedAmount;
  const pct = diff / stream.expectedAmount;
  if (Math.abs(pct) < threshold) return null;
  return {
    direction: pct > 0 ? 'higher' : 'lower',
    pct: Math.round(Math.abs(pct) * 100) / 100,
    expected: stream.expectedAmount,
    actual: stream.lastAmount,
  };
}
