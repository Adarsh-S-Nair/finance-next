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

    console.log(`🔍 Current Net Worth API: Getting net worth for user ${userId}`);

    // Get all accounts for the user with their current balances
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, type, subtype, balances')
      .eq('user_id', userId);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    console.log(`🔍 Current Net Worth API: Found ${accounts.length} accounts`);
    console.log('🔍 Current Net Worth API: Account details:', accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      type: acc.subtype || acc.type,
      balance: acc.balances?.current,
      isLiability: isLiabilityAccount(acc)
    })));

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ 
        netWorth: 0,
        assets: 0,
        liabilities: 0,
        totalAccounts: 0,
        accountBreakdown: [],
        message: 'No accounts found for user'
      });
    }

    // Calculate net worth using current balances from accounts table
    let totalAssets = 0;
    let totalLiabilities = 0;
    const accountBreakdown = [];

    accounts.forEach(account => {
      // Extract current balance from the JSONB balances column
      const balance = account.balances?.current || 0;
      
      // Determine if this is a liability account
      const isLiability = isLiabilityAccount(account);
      
      const accountData = {
        accountId: account.id,
        accountName: account.name,
        accountType: account.subtype || account.type,
        balance: balance,
        isLiability: isLiability,
        lastUpdated: new Date().toISOString() // Current time since we're using live balances
      };

      if (isLiability) {
        totalLiabilities += Math.abs(balance);
        accountData.contribution = -Math.abs(balance);
      } else {
        totalAssets += balance;
        accountData.contribution = balance;
      }

      accountBreakdown.push(accountData);
    });

    const netWorth = totalAssets - totalLiabilities;

    console.log(`🔍 Current Net Worth API: Assets: $${totalAssets.toFixed(2)}, Liabilities: $${totalLiabilities.toFixed(2)}, Net Worth: $${netWorth.toFixed(2)}`);

    const response = {
      netWorth: Math.round(netWorth * 100) / 100, // Round to 2 decimal places
      assets: Math.round(totalAssets * 100) / 100,
      liabilities: Math.round(totalLiabilities * 100) / 100,
      totalAccounts: accounts.length,
      accountsWithBalances: accounts.filter(acc => acc.balances?.current !== null).length,
      accountBreakdown: accountBreakdown,
      calculatedAt: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in current net worth API:', error);
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
