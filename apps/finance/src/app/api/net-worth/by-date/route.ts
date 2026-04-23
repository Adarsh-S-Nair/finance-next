import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { isLiabilityAccount } from '../../../../lib/accountUtils';
import { resolveScope } from '../../../../lib/api/scope';

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

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooTicker)}?interval=1d&period1=${startTs}&period2=${endTs}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );
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
        priceMap[new Date(timestamps[i] * 1000).toLocaleDateString('en-CA')] = c;
      }
    }
    return priceMap;
  } catch (err) {
    console.error(
      `[net-worth/by-date] Yahoo price fetch failed for ${yahooTicker}:`,
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

interface SnapshotState {
  account: { id: string; balances: unknown };
  isLiability: boolean;
  snapshots: { date: string; balance: number }[];
  pointer: number;
  latestBalance: number;
}

export const GET = withAuth('net-worth:by-date', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const maxDaysParam = parseInt(searchParams.get('maxDays') || '0', 10);
  const MAX_DAYS =
    Number.isFinite(maxDaysParam) && maxDaysParam > 0 ? Math.min(maxDaysParam, 365) : 365;
  const minimal = (searchParams.get('minimal') || '0') === '1';

  const scope = await resolveScope(request, userId);
  if (scope instanceof Response) return scope;

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, name, type, subtype, balances')
    .in('user_id', scope.userIds);

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ data: [], message: 'No accounts found for user' });
  }

  const accountIds = accounts.map((a) => a.id);
  const investmentAccountIds = accounts
    .filter((a) => a.type === 'investment')
    .map((a) => a.id);
  const todayISO = toISODateString(new Date());

  let holdings: { account_id: string; ticker: string; shares: number; asset_type: string | null }[] = [];
  if (investmentAccountIds.length > 0) {
    const { data: h } = await supabaseAdmin
      .from('holdings')
      .select('account_id, ticker, shares, asset_type')
      .in('account_id', investmentAccountIds);
    holdings = h || [];
  }
  const hasHoldings = holdings.length > 0;

  const { data: allSnapshots, error: snapshotsError } = await supabaseAdmin
    .from('account_snapshots')
    .select('account_id, current_balance, recorded_at')
    .in('account_id', accountIds)
    .order('recorded_at', { ascending: true });

  if (snapshotsError) {
    console.error('Error fetching snapshots:', snapshotsError);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }

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

  const investmentAccountSet = new Set(investmentAccountIds);
  let tickerMap: Map<string, TickerInfo> | null = null;
  let priceMaps: Map<string, Record<string, number>> | null = null;
  const holdingsCashByAccount: Record<string, number> = {};

  if (hasHoldings) {
    tickerMap = new Map();
    for (const h of holdings) {
      const shares = toNumber(h.shares);
      if (shares <= 0) continue;

      if (h.asset_type === 'cash' || h.ticker === 'CUR:USD') {
        holdingsCashByAccount[h.account_id] =
          (holdingsCashByAccount[h.account_id] || 0) + shares;
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
      tickers.map((t) => fetchYahooPrices(t, tickerMap!.get(t)!.isCrypto, dateRange[0], todayISO))
    );
    priceMaps = new Map();
    tickers.forEach((t, i) => {
      if (priceResults[i]) priceMaps!.set(t, priceResults[i]!);
    });
  }

  const holdingsAvailable = hasHoldings && !!priceMaps && priceMaps.size > 0;

  const initialBalances: Record<string, number> = {};
  (allSnapshots || []).forEach((s) => {
    if (initialBalances[s.account_id] === undefined) {
      initialBalances[s.account_id] = toNumber(s.current_balance);
    }
  });

  const snapshotsByAccount = new Map<string, { date: string; balance: number }[]>();
  const snapshotDatesSet = new Set<string>();
  (allSnapshots || []).forEach((s) => {
    const ds = toISODateString(new Date(s.recorded_at));
    snapshotDatesSet.add(ds);
    if (!snapshotsByAccount.has(s.account_id)) snapshotsByAccount.set(s.account_id, []);
    snapshotsByAccount
      .get(s.account_id)!
      .push({ date: ds, balance: toNumber(s.current_balance) });
  });

  const snapshotAccounts = accounts.filter(
    (a) => !investmentAccountSet.has(a.id) || !holdingsAvailable
  );
  const holdingsAccounts = holdingsAvailable
    ? accounts.filter((a) => investmentAccountSet.has(a.id))
    : [];

  const snapshotStates: SnapshotState[] = snapshotAccounts.map((account) => ({
    account,
    isLiability: isLiabilityAccount(account),
    snapshots: snapshotsByAccount.get(account.id) || [],
    pointer: 0,
    latestBalance: initialBalances[account.id] || 0,
  }));

  interface SeriesPoint {
    date: string;
    netWorth: number;
    assets: number;
    liabilities: number;
    accountBalances?: Record<string, number>;
    totalAccounts?: number;
    accountsWithData?: number;
    usesCurrentBalances?: boolean;
    isInterpolated?: boolean;
    hasSnapshotOnDate?: boolean;
  }
  const series: SeriesPoint[] = [];

  for (const dateString of dateRange) {
    const isToday = dateString === todayISO;
    let totalAssets = 0;
    let totalLiabilities = 0;
    const accountBalances: Record<string, number> = {};

    for (const state of snapshotStates) {
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

      if (state.isLiability) {
        totalLiabilities += Math.abs(balance);
        accountBalances[state.account.id] = -Math.abs(balance);
      } else {
        totalAssets += balance;
        accountBalances[state.account.id] = balance;
      }
    }

    for (const account of holdingsAccounts) {
      if (isToday) {
        const b = account.balances as { current?: number | null } | null;
        const live = toNumber(b?.current);
        totalAssets += live;
        accountBalances[account.id] = live;
      } else {
        let value = holdingsCashByAccount[account.id] || 0;
        if (tickerMap) {
          for (const [ticker, info] of tickerMap) {
            const accShares = info.accountShares.get(account.id);
            if (!accShares) continue;
            const pm = priceMaps?.get(ticker);
            if (!pm) continue;
            const price = getPrice(pm, dateString);
            if (price != null) value += accShares * price;
          }
        }
        totalAssets += value;
        accountBalances[account.id] = Math.round(value * 100) / 100;
      }
    }

    const netWorth = totalAssets - totalLiabilities;

    if (minimal) {
      series.push({
        date: dateString,
        netWorth: Math.round(netWorth * 100) / 100,
        assets: Math.round(totalAssets * 100) / 100,
        liabilities: Math.round(totalLiabilities * 100) / 100,
      });
    } else {
      series.push({
        date: dateString,
        assets: Math.round(totalAssets * 100) / 100,
        liabilities: Math.round(totalLiabilities * 100) / 100,
        netWorth: Math.round(netWorth * 100) / 100,
        accountBalances,
        totalAccounts: accounts.length,
        accountsWithData: Object.keys(accountBalances).length,
        usesCurrentBalances: isToday,
        isInterpolated: !snapshotDatesSet.has(dateString) && !isToday,
        hasSnapshotOnDate: snapshotDatesSet.has(dateString),
      });
    }
  }

  if (minimal) {
    return NextResponse.json({
      data: series,
      totalDates: series.length,
      totalAccounts: accounts.length,
      minimal: true,
    });
  }

  return NextResponse.json({
    data: series,
    totalDates: series.length,
    totalAccounts: accounts.length,
    originalSnapshotDates: snapshotDatesSet.size,
    interpolatedDates: series.filter((s) => s.isInterpolated).length,
    dateRange: {
      earliest: series[0]?.date || null,
      latest: series[series.length - 1]?.date || null,
    },
  });
});
