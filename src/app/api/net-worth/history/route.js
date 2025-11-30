import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';
const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const months = parseInt(searchParams.get('months') || '12');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Calculate the date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get all accounts for the user
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, type, subtype')
      .eq('user_id', userId);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const accountIds = accounts.map(account => account.id);

    // Get ALL snapshots for these accounts to find the very first balance for each
    // We need this for backfilling
    const { data: allSnapshots, error: allSnapshotsError } = await supabaseAdmin
      .from('account_snapshots')
      .select('account_id, current_balance, recorded_at')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: true });

    if (allSnapshotsError) {
      console.error('Error fetching all snapshots:', allSnapshotsError);
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }

    // DEBUG: Log first few snapshots to see what we're working with
    console.log('🔍 DEBUG: Total snapshots found:', allSnapshots.length);
    if (allSnapshots.length > 0) {
      console.log('🔍 DEBUG: First 5 snapshots:', JSON.stringify(allSnapshots.slice(0, 5), null, 2));
    }

    // Determine the initial balance for each account (the first ever recorded balance)
    const initialBalances = {};
    const firstRecordedDate = {};

    allSnapshots.forEach(snapshot => {
      if (initialBalances[snapshot.account_id] === undefined) {
        // Log when we find the first snapshot for an account
        console.log(`🔍 DEBUG: Found first snapshot for account ${snapshot.account_id}: ${snapshot.current_balance} at ${snapshot.recorded_at}`);
        initialBalances[snapshot.account_id] = snapshot.current_balance;
        firstRecordedDate[snapshot.account_id] = new Date(snapshot.recorded_at);
      }
    });

    console.log('🔍 DEBUG: Final Initial Balances:', JSON.stringify(initialBalances, null, 2));

    // Create a map of snapshots by date and account
    const snapshotsByDate = {};
    allSnapshots.forEach(snapshot => {
      const date = new Date(snapshot.recorded_at).toISOString().split('T')[0];
      if (!snapshotsByDate[date]) {
        snapshotsByDate[date] = {};
      }
      snapshotsByDate[date][snapshot.account_id] = snapshot.current_balance;
    });

    // Generate daily data points from start date to end date
    const netWorthHistory = [];
    const currentBalances = { ...initialBalances }; // Start with initial balances

    // We iterate day by day
    const currentDate = new Date(startDate);
    const endDateTime = endDate.getTime();

    while (currentDate.getTime() <= endDateTime) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // Update current balances with any snapshots from this day
      if (snapshotsByDate[dateStr]) {
        Object.entries(snapshotsByDate[dateStr]).forEach(([accountId, balance]) => {
          currentBalances[accountId] = balance;
        });
      }

      // Calculate net worth for this day
      let assets = 0;
      let liabilities = 0;
      const accountBalances = {};

      accounts.forEach(account => {
        const balance = currentBalances[account.id] || 0;
        const isLiability = isLiabilityAccount(account);

        if (isLiability) {
          liabilities += Math.abs(balance);
          accountBalances[account.id] = -Math.abs(balance);
        } else {
          assets += balance;
          accountBalances[account.id] = balance;
        }
      });

      netWorthHistory.push({
        date: dateStr,
        assets,
        liabilities,
        netWorth: assets - liabilities,
        accountBalances
      });

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (DEBUG) {
      console.log(`🔍 API Debug: Generated ${netWorthHistory.length} daily net worth data points`);
      console.log(`🔍 API Debug: Initial Balances:`, initialBalances);
    }

    return NextResponse.json({ data: netWorthHistory });

  } catch (error) {
    console.error('Error in net worth history API:', error);
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
