import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';

const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

function toISODateString(date) {
  return date.toISOString().split('T')[0];
}

function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampStartDate(earliestSnapshotDate, todayDate, maxDays) {
  const lookbackStart = new Date(todayDate);
  lookbackStart.setDate(lookbackStart.getDate() - (maxDays - 1));

  if (!earliestSnapshotDate) {
    return new Date(todayDate);
  }

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
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const maxDaysParam = parseInt(searchParams.get('maxDays') || '0', 10);
    const MAX_DAYS = Number.isFinite(maxDaysParam) && maxDaysParam > 0 ? Math.min(maxDaysParam, 365) : 365; // cap to 1 year
    const minimal = (searchParams.get('minimal') || '0') === '1';

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (DEBUG) console.log(`🔍 Net Worth by Date API: user ${userId}`);

    // Get all accounts for the user with their current balances
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type, subtype, balances')
      .eq('user_id', userId);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    if (DEBUG) console.log(`🔍 Net Worth by Date API: accounts=${accounts.length}`);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ 
        data: [],
        message: 'No accounts found for user'
      });
    }

    const accountIds = accounts.map(account => account.id);

    const todayISODate = toISODateString(new Date());
    const endOfTodayISO = new Date(`${todayISODate}T23:59:59.999Z`).toISOString();

    const { data: snapshotRows, error: snapshotsError } = await supabaseAdmin
      .from('account_snapshots')
      .select('account_id, current_balance, recorded_at')
      .in('account_id', accountIds)
      .lte('recorded_at', endOfTodayISO)
      .order('recorded_at', { ascending: true });

    if (snapshotsError) {
      console.error('Error fetching account snapshots:', snapshotsError);
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }

    const snapshotsByAccount = new Map();
    const snapshotDatesSet = new Set();

    (snapshotRows || []).forEach(snapshot => {
      const dateString = toISODateString(new Date(snapshot.recorded_at));
      snapshotDatesSet.add(dateString);

      if (!snapshotsByAccount.has(snapshot.account_id)) {
        snapshotsByAccount.set(snapshot.account_id, []);
      }

      snapshotsByAccount.get(snapshot.account_id).push({
        date: dateString,
        balance: toNumber(snapshot.current_balance)
      });
    });

    const sortedSnapshotDates = Array.from(snapshotDatesSet).sort((a, b) => new Date(a) - new Date(b));
    const earliestSnapshotDate = sortedSnapshotDates.length > 0 ? sortedSnapshotDates[0] : null;

    const startDate = clampStartDate(earliestSnapshotDate, todayISODate, MAX_DAYS);
    const todayDateObj = new Date(todayISODate);
    const effectiveStartDate = startDate > todayDateObj ? todayDateObj : startDate;
    const dateRange = buildDateRange(effectiveStartDate, todayISODate);
    const datesToProcess = dateRange.length > 0 ? dateRange.slice(-MAX_DAYS) : [todayISODate];

    const netWorthByDate = [];
    const totalAccounts = accounts.length;

    const accountStates = accounts.map(account => ({
      account,
      isLiability: isLiabilityAccount(account),
      snapshots: snapshotsByAccount.get(account.id) || [],
      pointer: 0,
      latestBalance: 0
    }));

    for (const dateString of datesToProcess) {
      const isToday = dateString === todayISODate;
      const hasSnapshotOnThisDate = snapshotDatesSet.has(dateString);
      const isInterpolatedDate = !hasSnapshotOnThisDate && !isToday;

      let totalAssets = 0;
      let totalLiabilities = 0;
      const accountBalances = {};

      for (const state of accountStates) {
        const { snapshots } = state;
        while (state.pointer < snapshots.length && snapshots[state.pointer].date <= dateString) {
          state.latestBalance = toNumber(snapshots[state.pointer].balance);
          state.pointer += 1;
        }

        let balance = toNumber(state.latestBalance);

        if (isToday) {
          balance = toNumber(state.account.balances?.current ?? balance);
        }

        if (state.isLiability) {
          const liabilityBalance = -Math.abs(balance);
          totalLiabilities += Math.abs(balance);
          accountBalances[state.account.id] = Math.abs(liabilityBalance) < 1e-8 ? 0 : liabilityBalance;
        } else {
          totalAssets += balance;
          accountBalances[state.account.id] = Math.abs(balance) < 1e-8 ? 0 : balance;
        }
      }

      const netWorth = totalAssets - totalLiabilities;

      // Build either a minimal or full payload per date
      if (minimal) {
        netWorthByDate.push({
          date: dateString,
          netWorth: Math.round(netWorth * 100) / 100,
          assets: Math.round(totalAssets * 100) / 100,
          liabilities: Math.round(totalLiabilities * 100) / 100,
        });
      } else {
        netWorthByDate.push({
          date: dateString,
          assets: Math.round(totalAssets * 100) / 100,
          liabilities: Math.round(totalLiabilities * 100) / 100,
          netWorth: Math.round(netWorth * 100) / 100,
          accountBalances,
          totalAccounts,
          accountsWithData: Object.keys(accountBalances).length,
          usesCurrentBalances: isToday,
          isInterpolated: isInterpolatedDate,
          hasSnapshotOnDate: hasSnapshotOnThisDate
        });
      }
    }

    if (DEBUG && netWorthByDate.length > 0) {
      const first = netWorthByDate[0];
      const last = netWorthByDate[netWorthByDate.length - 1];
      console.log(`📈 Net Worth by Date: points=${netWorthByDate.length} range=${first.date}->${last.date}`);
    }

    if (minimal) {
      return NextResponse.json({
        data: netWorthByDate,
        totalDates: netWorthByDate.length,
        totalAccounts,
        minimal: true,
      });
    }

    return NextResponse.json({
      data: netWorthByDate,
      totalDates: netWorthByDate.length,
      totalAccounts,
      originalSnapshotDates: snapshotDatesSet.size,
      interpolatedDates: netWorthByDate.filter(item => item.isInterpolated).length,
      dateRange: {
        earliest: netWorthByDate.length > 0 ? netWorthByDate[0].date : null,
        latest: netWorthByDate.length > 0 ? netWorthByDate[netWorthByDate.length - 1].date : null
      }
    });

  } catch (error) {
    console.error('Error in net worth by date API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to determine if an account is a liability
function isLiabilityAccount(account) {
  const liabilityTypes = [
    'credit card',
    'credit',
    'loan',
    'mortgage',
    'line of credit',
    'overdraft',
    'other'
  ];
  
  const accountType = (account.subtype || account.type || '').toLowerCase();
  return liabilityTypes.some(type => accountType.includes(type));
}