/**
 * GET /api/investments/by-date
 *
 * Returns a time-series of the user's aggregated investment portfolio value.
 * Mirrors the shape of /api/net-worth/by-date but restricted to investment
 * accounts only, so the investments page can chart the total portfolio over
 * time the same way the accounts page charts net worth.
 *
 * Query params:
 *   maxDays (default 365, max 365) — lookback window
 *
 * Response:
 *   { data: Array<{ date: string, value: number, accountBalances: Record<id, number> }>,
 *     totalDates: number,
 *     totalAccounts: number }
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

function toISODateString(date) {
  return date.toISOString().split('T')[0];
}

function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampStartDate(earliestSnapshotDate, todayDate, maxDays) {
  const lookbackStart = new Date(todayDate);
  lookbackStart.setDate(lookbackStart.getDate() - (maxDays - 1));
  if (!earliestSnapshotDate) return new Date(todayDate);
  const earliest = new Date(earliestSnapshotDate);
  return earliest > lookbackStart ? earliest : lookbackStart;
}

function buildDateRange(startDate, endDate) {
  const dates = [];
  const cursor = new Date(startDate);
  const limit = new Date(endDate);
  while (cursor <= limit) {
    dates.push(toISODateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export async function GET(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const { searchParams } = new URL(request.url);
    const maxDaysParam = parseInt(searchParams.get('maxDays') || '0', 10);
    const MAX_DAYS = Number.isFinite(maxDaysParam) && maxDaysParam > 0 ? Math.min(maxDaysParam, 365) : 365;

    // Only investment accounts
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

    const accountIds = accounts.map(a => a.id);
    const todayISODate = toISODateString(new Date());
    const endOfTodayISO = new Date(`${todayISODate}T23:59:59.999Z`).toISOString();

    // Pull every snapshot we have for these accounts, oldest first
    const { data: allSnapshots, error: snapshotsError } = await supabaseAdmin
      .from('account_snapshots')
      .select('account_id, current_balance, recorded_at')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: true });

    if (snapshotsError) {
      console.error('Error fetching investment snapshots:', snapshotsError);
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }

    // Backfill: use each account's first-ever snapshot as the starting balance
    // for days before its first recorded snapshot
    const initialBalances = {};
    (allSnapshots || []).forEach(snapshot => {
      if (initialBalances[snapshot.account_id] === undefined) {
        initialBalances[snapshot.account_id] = toNumber(snapshot.current_balance);
      }
    });

    const snapshotRows = (allSnapshots || []).filter(
      s => new Date(s.recorded_at) <= new Date(endOfTodayISO)
    );

    const snapshotsByAccount = new Map();
    const snapshotDatesSet = new Set();

    snapshotRows.forEach(snapshot => {
      const dateString = toISODateString(new Date(snapshot.recorded_at));
      snapshotDatesSet.add(dateString);

      if (!snapshotsByAccount.has(snapshot.account_id)) {
        snapshotsByAccount.set(snapshot.account_id, []);
      }
      snapshotsByAccount.get(snapshot.account_id).push({
        date: dateString,
        balance: toNumber(snapshot.current_balance),
      });
    });

    const sortedSnapshotDates = Array.from(snapshotDatesSet).sort(
      (a, b) => new Date(a) - new Date(b)
    );
    const earliestSnapshotDate = sortedSnapshotDates.length > 0 ? sortedSnapshotDates[0] : null;

    const startDate = clampStartDate(earliestSnapshotDate, todayISODate, MAX_DAYS);
    const todayDateObj = new Date(todayISODate);
    const effectiveStartDate = startDate > todayDateObj ? todayDateObj : startDate;
    const dateRange = buildDateRange(effectiveStartDate, todayISODate);
    const datesToProcess = dateRange.length > 0 ? dateRange.slice(-MAX_DAYS) : [todayISODate];

    const accountStates = accounts.map(account => ({
      account,
      snapshots: snapshotsByAccount.get(account.id) || [],
      pointer: 0,
      latestBalance: initialBalances[account.id] || 0,
    }));

    const series = [];

    for (const dateString of datesToProcess) {
      const isToday = dateString === todayISODate;

      let total = 0;
      const accountBalances = {};

      for (const state of accountStates) {
        const { snapshots } = state;
        while (state.pointer < snapshots.length && snapshots[state.pointer].date <= dateString) {
          state.latestBalance = toNumber(snapshots[state.pointer].balance);
          state.pointer += 1;
        }

        let balance = toNumber(state.latestBalance);
        if (isToday) {
          // For "today", prefer the live accounts.balances.current value
          // (holdings sync keeps this fresh for investment accounts)
          balance = toNumber(state.account.balances?.current ?? balance);
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
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error in /api/investments/by-date:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
