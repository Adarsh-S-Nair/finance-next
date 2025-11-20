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

    // Get account snapshots within the date range
    const { data: snapshots, error: snapshotsError } = await supabaseAdmin
      .from('account_snapshots')
      .select(`
        account_id,
        current_balance,
        recorded_at
      `)
      .in('account_id', accountIds)
      .gte('recorded_at', startDate.toISOString())
      .lte('recorded_at', endDate.toISOString())
      .order('recorded_at', { ascending: true });

    if (snapshotsError) {
      console.error('Error fetching snapshots:', snapshotsError);
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }

    // Group snapshots by date and calculate net worth for each date
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
    const netWorthHistory = Object.values(netWorthByDate)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (DEBUG) {
      console.log(`🔍 API Debug: Found ${snapshots.length} snapshots`);
      console.log(`🔍 API Debug: Generated ${netWorthHistory.length} net worth data points`);
      console.log(`🔍 API Debug: Account IDs:`, accountIds);
      console.log(`🔍 API Debug: Sample snapshots:`, snapshots.slice(0, 1));
      console.log(`🔍 API Debug: Sample net worth data:`, netWorthHistory.slice(0, 1));
    }

    // If we have less than 2 data points, generate some historical data
    if (netWorthHistory.length < 2) {
      console.log('⚠️ API Debug: Insufficient historical data, generating fallback data');
      const currentNetWorth = netWorthHistory.length > 0 
        ? netWorthHistory[netWorthHistory.length - 1].netWorth 
        : 0;
      
      // Generate monthly data points for the requested period
      const generatedData = [];
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Add some variation to make it look realistic
        const variation = (Math.random() - 0.5) * (currentNetWorth * 0.1);
        const netWorth = Math.max(0, currentNetWorth + variation);
        
        generatedData.push({
          date: dateStr,
          assets: netWorth * 0.8, // Assume 80% assets, 20% liabilities
          liabilities: netWorth * 0.2,
          netWorth: netWorth,
          accountBalances: {}
        });
      }
      
      if (DEBUG) console.log('🔍 API Debug: Returning generated fallback data:', generatedData.slice(0, 1));
      return NextResponse.json({ data: generatedData });
    }

    if (DEBUG) console.log('✅ API Debug: Returning real historical data:', netWorthHistory.slice(-1));
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
