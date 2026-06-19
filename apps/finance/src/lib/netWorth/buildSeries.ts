/**
 * Server-side builder shared by the net-worth and investments chart endpoints.
 *
 * Given a set of account rows and a range, it loads holdings + snapshots,
 * prices holdings over time via Yahoo (intraday for short ranges), anchors 1D
 * to the last trading session, and assembles a fixed, evenly-spaced series.
 *
 * The net-worth endpoint passes all accounts (assets net of liabilities); the
 * investments endpoint passes only investment accounts (so the assembled
 * `netWorth` equals total holdings value). The pure math lives in ./series.
 */
import { supabaseAdmin } from '../supabase/admin';
import { isLiabilityAccount } from '../accountUtils';
import {
  planRange,
  evenTimestamps,
  assembleNetWorthSeries,
  lastTradingSessionOpenMs,
  type NetWorthRange,
  type AccountLite,
  type SnapshotPoint,
  type HoldingLite,
  type PricePoint,
  type NetWorthSeriesPoint,
} from './series';

export interface AccountRow {
  id: string;
  type: string | null;
  subtype: string | null;
  balances: unknown;
  plaid_balance_current: number | null;
  created_at: string | null;
}

export interface BuiltSeries {
  data: NetWorthSeriesPoint[];
  range: NetWorthRange;
  points: number;
  intraday: boolean;
  holdingsPriced: boolean;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Fetch a price series from Yahoo at the given interval. Returns points sorted
 * ascending by time, or an empty array on any failure (the assembler falls
 * back to snapshots when a series is empty, so this never throws).
 */
async function fetchYahooSeries(
  ticker: string,
  isCrypto: boolean,
  interval: string,
  startMs: number,
  endMs: number
): Promise<PricePoint[]> {
  const yahooTicker = isCrypto ? `${ticker}-USD` : ticker;
  const period1 = Math.floor(startMs / 1000) - 86400 * 3;
  const period2 = Math.floor(endMs / 1000) + 86400;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        yahooTicker
      )}?interval=${interval}&period1=${period1}&period2=${period2}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );
    if (!res.ok) return [];

    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
      };
    };
    const result = data.chart?.result?.[0];
    if (!result) return [];

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const out: PricePoint[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c != null) out.push({ tMs: timestamps[i] * 1000, price: c });
    }
    out.sort((a, b) => a.tMs - b.tMs);
    return out;
  } catch (err) {
    console.error(
      `[net-worth/buildSeries] Yahoo fetch failed for ${yahooTicker}:`,
      err instanceof Error ? err.message : String(err)
    );
    return [];
  }
}

export async function buildSeriesForAccounts(
  accounts: AccountRow[],
  range: NetWorthRange,
  nowMs: number
): Promise<BuiltSeries> {
  let connectionMs: number | null = null;
  for (const a of accounts) {
    if (!a.created_at) continue;
    const ms = new Date(a.created_at).getTime();
    if (connectionMs === null || ms < connectionMs) connectionMs = ms;
  }

  const plan = planRange(range, nowMs, connectionMs);

  const accountIds = accounts.map((a) => a.id);
  const investmentAccountIds = accounts
    .filter((a) => a.type === 'investment')
    .map((a) => a.id);

  // --- Holdings ---
  let holdings: {
    account_id: string;
    ticker: string;
    shares: number;
    asset_type: string | null;
  }[] = [];
  if (investmentAccountIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('holdings')
      .select('account_id, ticker, shares, asset_type')
      .in('account_id', investmentAccountIds);
    holdings = data || [];
  }

  const holdingsByAccount = new Map<string, HoldingLite[]>();
  const tickerIsCrypto = new Map<string, boolean>();
  for (const h of holdings) {
    const shares = toNumber(h.shares);
    if (shares <= 0) continue;
    const isCash = h.asset_type === 'cash' || h.ticker === 'CUR:USD';
    if (!holdingsByAccount.has(h.account_id)) holdingsByAccount.set(h.account_id, []);
    holdingsByAccount.get(h.account_id)!.push({ ticker: h.ticker, shares, isCash });
    if (!isCash) tickerIsCrypto.set(h.ticker, h.asset_type === 'crypto');
  }

  // --- Snapshots (all, ascending) ---
  const snapshotsByAccount = new Map<string, SnapshotPoint[]>();
  const initialBalanceByAccount = new Map<string, number>();
  if (accountIds.length > 0) {
    const { data: allSnapshots } = await supabaseAdmin
      .from('account_snapshots')
      .select('account_id, current_balance, recorded_at')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: true });

    for (const s of allSnapshots || []) {
      const tMs = new Date(s.recorded_at).getTime();
      const balance = toNumber(s.current_balance);
      if (!snapshotsByAccount.has(s.account_id)) {
        snapshotsByAccount.set(s.account_id, []);
        initialBalanceByAccount.set(s.account_id, balance);
      }
      snapshotsByAccount.get(s.account_id)!.push({ tMs, balance });
    }
  }

  // --- Price series for each distinct (non-cash) ticker ---
  const tickers = [...tickerIsCrypto.keys()];
  const priceSeries = new Map<string, PricePoint[]>();
  if (tickers.length > 0) {
    const results = await Promise.all(
      tickers.map((t) =>
        fetchYahooSeries(t, tickerIsCrypto.get(t)!, plan.yahooInterval, plan.startMs, plan.endMs)
      )
    );
    tickers.forEach((t, i) => {
      if (results[i].length > 0) priceSeries.set(t, results[i]);
    });
  }
  const holdingsAvailable = priceSeries.size > 0;

  // For 1D, anchor the window to the last real trading session so the chart
  // shows that session's movement instead of being flat when the market is
  // currently closed (weekend / holiday).
  let startMs = plan.startMs;
  if (range === '1D' && holdingsAvailable) {
    const merged: PricePoint[] = [];
    for (const arr of priceSeries.values()) merged.push(...arr);
    const sessionOpen = lastTradingSessionOpenMs(merged);
    if (sessionOpen != null) startMs = Math.min(startMs, sessionOpen);
  }

  const accountsLite: AccountLite[] = accounts.map((a) => {
    const b = a.balances as { current?: number | null } | null;
    const currentBalance = toNumber(b?.current ?? a.plaid_balance_current ?? 0);
    return {
      id: a.id,
      isLiability: isLiabilityAccount(a),
      isInvestment: a.type === 'investment',
      currentBalance,
    };
  });

  const targets = evenTimestamps(startMs, plan.endMs, plan.points);
  const data = assembleNetWorthSeries({
    targets,
    accounts: accountsLite,
    snapshotsByAccount,
    initialBalanceByAccount,
    holdingsByAccount,
    priceSeries,
    holdingsAvailable,
  });

  return {
    data,
    range,
    points: data.length,
    intraday: plan.intraday,
    holdingsPriced: holdingsAvailable,
  };
}
