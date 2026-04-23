/**
 * GET /api/investments/by-date
 *
 * Time-series of the user's aggregated investment portfolio value.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';

function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(startDate);
  const limit = new Date(endDate);
  while (cursor <= limit) {
    dates.push(toISODateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

async function fetchYahooPrices(
  ticker: string,
  isCrypto: boolean,
  startDate: string,
  endDate: string
): Promise<Record<string, number> | null> {
  const yahooTicker = isCrypto ? `${ticker}-USD` : ticker;
  const startTs = Math.floor(new Date(startDate).getTime() / 1000) - 86400 * 3;
  const endTs = Math.floor(new Date(endDate).getTime() / 1000) + 86400;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&period1=${startTs}&period2=${endTs}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: (number | null)[] }> };
        }>;
      };
    };
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];

    const priceMap: Record<string, number> = {};
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (c != null) {
        const dateStr = new Date(timestamps[i] * 1000).toLocaleDateString('en-CA');
        priceMap[dateStr] = c;
      }
    }
    return priceMap;
  } catch (err) {
    console.error(
      `[investments/by-date] Yahoo price fetch failed for ${yahooTicker}:`,
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

function getPrice(priceMap: Record<string, number>, dateString: string): number | null {
  if (priceMap[dateString] != null) return priceMap[dateString];
  const d = new Date(dateString);
  for (let i = 1; i <= 5; i++) {
    d.setDate(d.getDate() - 1);
    const prev = toISODateString(d);
    if (priceMap[prev] != null) return priceMap[prev];
  }
  return null;
}

interface TickerInfo {
  totalShares: number;
  isCrypto: boolean;
  accountShares: Map<string, number>;
}

export const GET = withAuth('investments:by-date', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const maxDaysParam = parseInt(searchParams.get('maxDays') || '0', 10);
  const MAX_DAYS =
    Number.isFinite(maxDaysParam) && maxDaysParam > 0 ? Math.min(maxDaysParam, 365) : 365;

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, name, type, subtype, balances')
    .eq('user_id', userId)
    .eq('type', 'investment');

  if (accountsError) {
    console.error('Error fetching investment accounts:', accountsError);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ data: [], totalAccounts: 0, totalDates: 0 });
  }

  const accountIds = accounts.map((a) => a.id);
  const todayISO = toISODateString(new Date());

  const { data: holdings } = await supabaseAdmin
    .from('holdings')
    .select('account_id, ticker, shares, asset_type')
    .in('account_id', accountIds);

  const hasHoldings = !!holdings && holdings.length > 0;

  const { data: allSnapshots } = await supabaseAdmin
    .from('account_snapshots')
    .select('account_id, current_balance, recorded_at')
    .in('account_id', accountIds)
    .order('recorded_at', { ascending: true });

  const sortedSnapshotDates = [
    ...new Set((allSnapshots || []).map((s) => toISODateString(new Date(s.recorded_at)))),
  ].sort();
  const earliestSnapshotDate = sortedSnapshotDates[0] || todayISO;

  const lookbackStart = new Date(todayISO);
  lookbackStart.setDate(lookbackStart.getDate() - (MAX_DAYS - 1));
  const lookbackStartISO = toISODateString(lookbackStart);

  const startDate = hasHoldings
    ? lookbackStartISO
    : new Date(earliestSnapshotDate) > lookbackStart
      ? earliestSnapshotDate
      : lookbackStartISO;
  const dateRange = buildDateRange(startDate, todayISO).slice(-MAX_DAYS);

  if (hasHoldings) {
    const tickerMap = new Map<string, TickerInfo>();
    let totalCash = 0;
    const cashByAccount: Record<string, number> = {};

    for (const h of holdings) {
      const shares = toNumber(h.shares);
      if (shares <= 0) continue;

      if (h.asset_type === 'cash' || h.ticker === 'CUR:USD') {
        totalCash += shares;
        cashByAccount[h.account_id] = (cashByAccount[h.account_id] || 0) + shares;
        continue;
      }

      if (!tickerMap.has(h.ticker)) {
        tickerMap.set(h.ticker, {
          totalShares: 0,
          isCrypto: h.asset_type === 'crypto',
          accountShares: new Map(),
        });
      }
      const entry = tickerMap.get(h.ticker)!;
      entry.totalShares += shares;
      entry.accountShares.set(
        h.account_id,
        (entry.accountShares.get(h.account_id) || 0) + shares
      );
    }

    const tickers = [...tickerMap.keys()];
    const priceResults = await Promise.all(
      tickers.map((ticker) =>
        fetchYahooPrices(ticker, tickerMap.get(ticker)!.isCrypto, dateRange[0], todayISO)
      )
    );

    const priceMaps = new Map<string, Record<string, number>>();
    tickers.forEach((ticker, i) => {
      if (priceResults[i]) priceMaps.set(ticker, priceResults[i]!);
    });

    if (priceMaps.size > 0) {
      const series: Array<{
        date: string;
        value: number;
        accountBalances: Record<string, number>;
      }> = [];

      for (const dateString of dateRange) {
        const isToday = dateString === todayISO;
        let total = 0;
        const accountBalances: Record<string, number> = {};

        for (const account of accounts) {
          accountBalances[account.id] = cashByAccount[account.id] || 0;
        }

        if (isToday) {
          for (const account of accounts) {
            const b = account.balances as { current?: number | null } | null;
            const live = toNumber(b?.current);
            total += live;
            accountBalances[account.id] = live;
          }
        } else {
          for (const [ticker, info] of tickerMap) {
            const pm = priceMaps.get(ticker);
            if (!pm) continue;
            const price = getPrice(pm, dateString);
            if (price == null) continue;

            const value = info.totalShares * price;
            total += value;

            for (const [accId, accShares] of info.accountShares) {
              accountBalances[accId] = (accountBalances[accId] || 0) + accShares * price;
            }
          }
          total += totalCash;
        }

        series.push({
          date: dateString,
          value: Math.round(total * 100) / 100,
          accountBalances,
        });
      }

      return NextResponse.json({
        data: series,
        totalDates: series.length,
        totalAccounts: accounts.length,
      });
    }
  }

  // ─── Fallback: snapshot-based (sparse data) ───
  const initialBalances: Record<string, number> = {};
  (allSnapshots || []).forEach((s) => {
    if (initialBalances[s.account_id] === undefined) {
      initialBalances[s.account_id] = toNumber(s.current_balance);
    }
  });

  const snapshotsByAccount = new Map<string, { date: string; balance: number }[]>();
  (allSnapshots || []).forEach((s) => {
    if (!snapshotsByAccount.has(s.account_id)) {
      snapshotsByAccount.set(s.account_id, []);
    }
    snapshotsByAccount.get(s.account_id)!.push({
      date: toISODateString(new Date(s.recorded_at)),
      balance: toNumber(s.current_balance),
    });
  });

  const accountStates = accounts.map((account) => ({
    account,
    snapshots: snapshotsByAccount.get(account.id) || [],
    pointer: 0,
    latestBalance: initialBalances[account.id] || 0,
  }));

  const series: Array<{
    date: string;
    value: number;
    accountBalances: Record<string, number>;
  }> = [];
  for (const dateString of dateRange) {
    const isToday = dateString === todayISO;
    let total = 0;
    const accountBalances: Record<string, number> = {};

    for (const state of accountStates) {
      while (
        state.pointer < state.snapshots.length &&
        state.snapshots[state.pointer].date <= dateString
      ) {
        state.latestBalance = state.snapshots[state.pointer].balance;
        state.pointer += 1;
      }
      let balance = state.latestBalance;
      if (isToday) {
        const b = state.account.balances as { current?: number | null } | null;
        balance = toNumber(b?.current ?? balance);
      }
      total += balance;
      accountBalances[state.account.id] = Math.abs(balance) < 1e-8 ? 0 : balance;
    }

    series.push({
      date: dateString,
      value: Math.round(total * 100) / 100,
      accountBalances,
    });
  }

  return NextResponse.json({
    data: series,
    totalDates: series.length,
    totalAccounts: accounts.length,
  });
});
