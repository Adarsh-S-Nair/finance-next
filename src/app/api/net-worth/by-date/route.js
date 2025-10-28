import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to generate all dates between two dates (inclusive)
function generateDateRange(startDate, endDate) {
  const dates = [];
  const currentDate = new Date(startDate);
  const end = new Date(endDate);
  
  while (currentDate <= end) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
}

// Helper function to generate all dates from snapshots to today
function generateAllDates(snapshotDates, mostRecentDate) {
  if (snapshotDates.length === 0) {
    return [];
  }
  
  // Sort dates to get the earliest and latest
  const sortedDates = [...snapshotDates].sort((a, b) => new Date(a) - new Date(b));
  const earliestDate = sortedDates[0];
  const latestSnapshotDate = mostRecentDate;
  
  // Generate dates from earliest snapshot to today
  const today = new Date().toISOString().split('T')[0];
  const allDates = generateDateRange(earliestDate, today);
  
  console.log(`📅 Generated ${allDates.length} dates from ${earliestDate} to ${today}`);
  console.log(`📅 Original snapshot dates: ${snapshotDates.length}`);
  console.log(`📅 Interpolated dates: ${allDates.length - snapshotDates.length}`);
  
  return allDates;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    console.log(`🔍 Net Worth by Date API: Getting net worth history for user ${userId}`);

    // Get all accounts for the user with their current balances
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, type, subtype, balances')
      .eq('user_id', userId);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    console.log(`🔍 Net Worth by Date API: Found ${accounts.length} accounts`);

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ 
        data: [],
        message: 'No accounts found for user'
      });
    }

    const accountIds = accounts.map(account => account.id);

    // Get all unique dates from account snapshots
    const { data: uniqueDates, error: datesError } = await supabase
      .from('account_snapshots')
      .select('recorded_at')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: true });

    if (datesError) {
      console.error('Error fetching unique dates:', datesError);
      return NextResponse.json({ error: 'Failed to fetch dates' }, { status: 500 });
    }

    // Extract unique dates (just the date part, not time)
    const dateStrings = [...new Set(uniqueDates.map(snapshot => 
      new Date(snapshot.recorded_at).toISOString().split('T')[0]
    ))];

    console.log(`🔍 Net Worth by Date API: Found ${dateStrings.length} unique snapshot dates`);
    console.log('🔍 Net Worth by Date API: Snapshot dates:', dateStrings);
    console.log(`🔍 Net Worth by Date API: User has ${accounts.length} total accounts:`, accounts.map(acc => ({ id: acc.id, name: acc.name })));

    // Sort dates to find the most recent one
    const sortedDates = [...dateStrings].sort((a, b) => new Date(b) - new Date(a));
    const mostRecentDate = sortedDates.length > 0 ? sortedDates[0] : null;

    console.log(`🔍 Net Worth by Date API: Most recent snapshot date: ${mostRecentDate}`);

    // Preload all snapshot balances once per account to avoid thousands of round-trips.
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('account_snapshots')
      .select('account_id, current_balance, recorded_at')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: true });

    if (snapshotsError) {
      console.error('Error fetching account snapshots:', snapshotsError);
      return NextResponse.json({ error: 'Failed to fetch account snapshots' }, { status: 500 });
    }

    const snapshotsByAccount = new Map();
    for (const snapshot of snapshots || []) {
      if (!snapshot?.account_id || !snapshot?.recorded_at) continue;
      const list = snapshotsByAccount.get(snapshot.account_id) || [];
      const recordedAt = new Date(snapshot.recorded_at);
      list.push({
        balance: snapshot.current_balance || 0,
        recordedAt,
        recordedAtDate: recordedAt.toISOString().split('T')[0],
      });
      snapshotsByAccount.set(snapshot.account_id, list);
    }

    // Generate all dates from first snapshot to today
    const allDates = generateAllDates(dateStrings, mostRecentDate);
    console.log(`🔍 Net Worth by Date API: Generated ${allDates.length} total dates (including interpolated days)`);

    const todayIso = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayIso);
    const snapshotDateSet = new Set(dateStrings);
    const snapshotState = new Map();
    for (const account of accounts) {
      const items = snapshotsByAccount.get(account.id) || [];
      snapshotState.set(account.id, {
        index: -1,
        snapshots: items,
      });
    }

    // Calculate net worth for each date
    const netWorthByDate = [];

    for (const dateString of allDates) {
      const targetDate = new Date(dateString + 'T23:59:59Z'); // End of day
      let totalAssets = 0;
      let totalLiabilities = 0;
      const accountBalances = {};

      console.log(`\n📅 Calculating net worth for date: ${dateString}`);
      console.log(`  🎯 Target date: ${targetDate.toISOString()}`);

      // Check if this is today's date - if so, always use current balances from accounts table
      const isToday = dateString === todayIso;
      const isFutureDate = new Date(dateString) > todayDate;
      const isInterpolatedDate = !snapshotDateSet.has(dateString) && !isFutureDate;
      const hasSnapshotOnThisDate = snapshotDateSet.has(dateString);

      if (isToday || isFutureDate) {
        console.log(`  🔄 Using current balances from accounts table for ${isFutureDate ? 'future' : 'today'} date`);
      } else if (hasSnapshotOnThisDate) {
        console.log(`  📸 Using snapshot data for this date`);
      } else if (isInterpolatedDate) {
        console.log(`  📊 Interpolating data for missing date`);
      }

      // For EACH of the user's accounts, get the balance for this date
      for (const account of accounts) {
        let balance = 0;
        let dataSource = '';

        const state = snapshotState.get(account.id);
        const snapshotsForAccount = state?.snapshots || [];

        if (isToday || isFutureDate) {
          // Always use current balance from accounts table for today and future dates
          balance = account.balances?.current || 0;
          dataSource = 'Current balance';
        } else {
          let { index } = state || { index: -1 };
          while (
            index + 1 < snapshotsForAccount.length &&
            snapshotsForAccount[index + 1].recordedAt <= targetDate
          ) {
            index += 1;
          }

          if (state) {
            state.index = index;
          }

          const snapshotEntry = index >= 0 ? snapshotsForAccount[index] : null;

          if (snapshotEntry) {
            balance = snapshotEntry.balance;
            if (snapshotEntry.recordedAtDate === dateString) {
              dataSource = `Snapshot from ${snapshotEntry.recordedAtDate}`;
            } else {
              dataSource = `Latest snapshot from ${snapshotEntry.recordedAtDate}`;
            }
          } else {
            balance = 0;
            dataSource = 'No snapshot available';
          }
        }

        const isLiability = isLiabilityAccount(account);

        console.log(`  💰 ${account.name} (${account.subtype || account.type}): $${balance} ${isLiability ? '(liability)' : '(asset)'} [${dataSource}]`);

        // Always include the account in the calculation
        if (isLiability) {
          totalLiabilities += Math.abs(balance);
          accountBalances[account.id] = -Math.abs(balance);
        } else {
          totalAssets += balance;
          accountBalances[account.id] = balance;
        }
      }

      const netWorth = totalAssets - totalLiabilities;
      
      console.log(`  📊 Assets: $${totalAssets.toFixed(2)}, Liabilities: $${totalLiabilities.toFixed(2)}, Net Worth: $${netWorth.toFixed(2)}`);
      console.log(`  📈 Accounts included: ${Object.keys(accountBalances).length}/${accounts.length}`);

      netWorthByDate.push({
        date: dateString,
        assets: Math.round(totalAssets * 100) / 100,
        liabilities: Math.round(totalLiabilities * 100) / 100,
        netWorth: Math.round(netWorth * 100) / 100,
        accountBalances: accountBalances,
        totalAccounts: accounts.length,
        accountsWithData: Object.keys(accountBalances).length,
        usesCurrentBalances: isToday || isFutureDate,
        isInterpolated: isInterpolatedDate,
        hasSnapshotOnDate: hasSnapshotOnThisDate
      });
    }

    // Sort by date
    netWorthByDate.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log('\n📈 Final Net Worth by Date Results:');
    console.log('=====================================');
    netWorthByDate.forEach(item => {
      let status = '';
      if (item.usesCurrentBalances) {
        status = '[CURRENT BALANCES]';
      } else if (item.hasSnapshotOnDate) {
        status = '[SNAPSHOT DATA]';
      } else if (item.isInterpolated) {
        status = '[INTERPOLATED]';
      }
      console.log(`${item.date}: Net Worth = $${item.netWorth.toFixed(2)} (Assets: $${item.assets.toFixed(2)}, Liabilities: $${item.liabilities.toFixed(2)}) ${status}`);
    });

    const response = {
      data: netWorthByDate,
      totalDates: netWorthByDate.length,
      totalAccounts: accounts.length,
      originalSnapshotDates: dateStrings.length,
      interpolatedDates: netWorthByDate.filter(item => item.isInterpolated).length,
      dateRange: {
        earliest: netWorthByDate.length > 0 ? netWorthByDate[0].date : null,
        latest: netWorthByDate.length > 0 ? netWorthByDate[netWorthByDate.length - 1].date : null
      }
    };

    return NextResponse.json(response);

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