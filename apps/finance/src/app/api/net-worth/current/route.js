import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { isLiabilityAccount } from '../../../../lib/accountUtils';
import { resolveScope } from '../../../../lib/api/scope';
const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

export const GET = withAuth('net-worth:current', async (request, userId) => {
  const scope = await resolveScope(request, userId);
  if (scope instanceof Response) return scope;

  if (DEBUG) console.log(`🔍 Current Net Worth API: Getting net worth for ${scope.kind} scope`);

    // Household scope aggregates every member's accounts; personal only the caller.
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, name, type, subtype, balances')
      .in('user_id', scope.userIds);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    if (DEBUG) {
      console.log(`🔍 Current Net Worth API: Found ${accounts.length} accounts`);
    }

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

    if (DEBUG) console.log(`🔍 Current Net Worth API: Assets: $${totalAssets.toFixed(2)}, Liabilities: $${totalLiabilities.toFixed(2)}, Net Worth: $${netWorth.toFixed(2)}`);

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
});

