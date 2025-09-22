import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    console.log(`🔍 Net Worth by Date API: Found ${dateStrings.length} unique dates`);
    console.log('🔍 Net Worth by Date API: Unique dates:', dateStrings);
    console.log(`🔍 Net Worth by Date API: User has ${accounts.length} total accounts:`, accounts.map(acc => ({ id: acc.id, name: acc.name })));

    // Sort dates to find the most recent one
    const sortedDates = [...dateStrings].sort((a, b) => new Date(b) - new Date(a));
    const mostRecentDate = sortedDates.length > 0 ? sortedDates[0] : null;

    console.log(`🔍 Net Worth by Date API: Most recent date: ${mostRecentDate}`);

    // Calculate net worth for each date
    const netWorthByDate = [];

    for (const dateString of dateStrings) {
      const targetDate = new Date(dateString + 'T23:59:59Z'); // End of day
      let totalAssets = 0;
      let totalLiabilities = 0;
      const accountBalances = {};

      console.log(`\n📅 Calculating net worth for date: ${dateString}`);
      console.log(`  🎯 Target date: ${targetDate.toISOString()}`);

      // Check if this is the most recent date - if so, use current balances from accounts table
      const isMostRecentDate = dateString === mostRecentDate;
      
      if (isMostRecentDate) {
        console.log(`  🔄 Using current balances from accounts table for most recent date`);
      }

      // For EACH of the user's accounts, get the balance for this date
      for (const account of accounts) {
        let balance = 0;
        let dataSource = '';

        if (isMostRecentDate) {
          // Use current balance from accounts table for the most recent date
          balance = account.balances?.current || 0;
          dataSource = 'Current balance';
        } else {
          // For historical dates, get the most recent snapshot on or before this date
          const { data: latestSnapshot, error: snapshotError } = await supabase
            .from('account_snapshots')
            .select('current_balance, recorded_at')
            .eq('account_id', account.id)
            .lte('recorded_at', targetDate.toISOString())
            .order('recorded_at', { ascending: false })
            .limit(1);

          if (snapshotError) {
            console.error(`❌ Error fetching snapshot for account ${account.id} on ${dateString}:`, snapshotError);
            continue;
          }

          balance = latestSnapshot && latestSnapshot.length > 0 
            ? (latestSnapshot[0].current_balance || 0) 
            : 0;

          dataSource = latestSnapshot && latestSnapshot.length > 0 
            ? `Snapshot from ${new Date(latestSnapshot[0].recorded_at).toISOString().split('T')[0]}`
            : 'No snapshot';
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
        usesCurrentBalances: isMostRecentDate
      });
    }

    // Sort by date
    netWorthByDate.sort((a, b) => new Date(a.date) - new Date(b.date));

    console.log('\n📈 Final Net Worth by Date Results:');
    console.log('=====================================');
    netWorthByDate.forEach(item => {
      console.log(`${item.date}: Net Worth = $${item.netWorth.toFixed(2)} (Assets: $${item.assets.toFixed(2)}, Liabilities: $${item.liabilities.toFixed(2)})`);
    });

    const response = {
      data: netWorthByDate,
      totalDates: netWorthByDate.length,
      totalAccounts: accounts.length,
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
