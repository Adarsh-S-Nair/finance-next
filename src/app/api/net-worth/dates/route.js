import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { NextResponse } from 'next/server';
const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (DEBUG) console.log(`🔍 Dates API: Getting unique dates for user ${userId}`);

    // Get all accounts for the user
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type, subtype')
      .eq('user_id', userId);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    if (DEBUG) console.log(`🔍 Dates API: Found ${accounts.length} accounts`);

    if (accounts.length === 0) {
      return NextResponse.json({ 
        message: 'No accounts found for user',
        uniqueDates: [],
        totalSnapshots: 0
      });
    }

    const accountIds = accounts.map(account => account.id);

    // Get all unique dates from account snapshots
    const { data: snapshots, error: snapshotsError } = await supabaseAdmin
      .from('account_snapshots')
      .select('recorded_at, current_balance, account_id')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: true });

    if (snapshotsError) {
      console.error('Error fetching snapshots:', snapshotsError);
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }

    if (DEBUG) console.log(`🔍 Dates API: Found ${snapshots.length} total snapshots`);

    // Group by date and calculate net worth for each date
    const netWorthByDate = {};

    snapshots.forEach(snapshot => {
      const date = new Date(snapshot.recorded_at).toISOString().split('T')[0];
      const account = accounts.find(acc => acc.id === snapshot.account_id);
      
      if (!netWorthByDate[date]) {
        netWorthByDate[date] = {
          date,
          assets: 0,
          liabilities: 0,
          netWorth: 0,
          accountBalances: {}
        };
      }

      // Determine if this is a liability account
      const isLiability = isLiabilityAccount(account);
      const balance = snapshot.current_balance || 0;

      if (isLiability) {
        netWorthByDate[date].liabilities += Math.abs(balance);
        netWorthByDate[date].accountBalances[snapshot.account_id] = -Math.abs(balance);
      } else {
        netWorthByDate[date].assets += balance;
        netWorthByDate[date].accountBalances[snapshot.account_id] = balance;
      }
    });

    // Calculate net worth for each date
    Object.values(netWorthByDate).forEach(dayData => {
      dayData.netWorth = dayData.assets - dayData.liabilities;
    });

    // Convert to array and sort by date
    const uniqueDates = Object.values(netWorthByDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (DEBUG) {
      console.log(`🔍 Dates API: Generated ${uniqueDates.length} unique dates`);
      console.log(`🔍 Dates API: Sample dates:`, uniqueDates.slice(0, 1));
    }

    return NextResponse.json({ 
      data: uniqueDates,
      totalSnapshots: snapshots.length,
      totalAccounts: accounts.length
    });

  } catch (error) {
    console.error('Error in net worth dates API:', error);
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
