import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { isLiabilityAccount } from '../../../../lib/accountUtils';
import { resolveScope } from '../../../../lib/api/scope';
import {
  planRange,
  evenTimestamps,
  assembleNetWorthSeries,
  lastTradingSessionOpenMs,
  NET_WORTH_RANGES,
  type NetWorthRange,
  type AccountLite,
  type SnapshotPoint,
  type HoldingLite,
  type PricePoint,
} from '../../../../lib/netWorth/series';

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
      `[net-worth/series] Yahoo fetch failed for ${yahooTicker}:`,
      err instanceof Error ? err.message : String(err)
    );
    return [];
  }
}

export const GET = withAuth('net-worth:series', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const rawRange = (searchParams.get('range') || 'ALL').toUpperCase();
  const range: NetWorthRange = (NET_WORTH_RANGES as string[]).includes(rawRange)
    ? (rawRange as NetWorthRange)
    : 'ALL';

  const scope = await resolveScope(request, userId);
  if (scope instanceof Response) return scope;

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, type, subtype, balances, plaid_balance_current, created_at')
    .in('user_id', scope.userIds);

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ data: [], range, points: 0 });
  }

  const nowMs = Date.now();
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
  const { data: allSnapshots, error: snapshotsError } = await supabaseAdmin
    .from('account_snapshots')
    .select('account_id, current_balance, recorded_at')
    .in('account_id', accountIds)
    .order('recorded_at', { ascending: true });

  if (snapshotsError) {
    console.error('Error fetching snapshots:', snapshotsError);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }

  const snapshotsByAccount = new Map<string, SnapshotPoint[]>();
  const initialBalanceByAccount = new Map<string, number>();
  for (const s of allSnapshots || []) {
    const tMs = new Date(s.recorded_at).getTime();
    const balance = toNumber(s.current_balance);
    if (!snapshotsByAccount.has(s.account_id)) {
      snapshotsByAccount.set(s.account_id, []);
      initialBalanceByAccount.set(s.account_id, balance);
    }
    snapshotsByAccount.get(s.account_id)!.push({ tMs, balance });
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
  // currently closed (weekend / holiday). The price fetch above already buffers
  // a few days back, so the session's data is present.
  let startMs = plan.startMs;
  if (range === '1D' && holdingsAvailable) {
    const merged: PricePoint[] = [];
    for (const arr of priceSeries.values()) merged.push(...arr);
    const sessionOpen = lastTradingSessionOpenMs(merged);
    if (sessionOpen != null) startMs = Math.min(startMs, sessionOpen);
  }

  // --- Account lite view ---
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
  const series = assembleNetWorthSeries({
    targets,
    accounts: accountsLite,
    snapshotsByAccount,
    initialBalanceByAccount,
    holdingsByAccount,
    priceSeries,
    holdingsAvailable,
  });

  return NextResponse.json({
    data: series,
    range,
    points: series.length,
    intraday: plan.intraday,
    holdingsPriced: holdingsAvailable,
  });
});
