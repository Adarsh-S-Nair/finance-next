import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { isLiabilityAccount } from '../../../../lib/accountUtils';
import { resolveScope } from '../../../../lib/api/scope';
const DEBUG =
  process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

interface AccountBreakdownEntry {
  accountId: string;
  accountName: string;
  accountType: string | null;
  balance: number;
  isLiability: boolean;
  lastUpdated: string;
  contribution: number;
}

export const GET = withAuth('net-worth:current', async (request, userId) => {
  const scope = await resolveScope(request, userId);
  if (scope instanceof Response) return scope;

  if (DEBUG)
    console.log(`🔍 Current Net Worth API: Getting net worth for ${scope.kind} scope`);

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, name, type, subtype, balances')
    .in('user_id', scope.userIds);

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }

  if (DEBUG) {
    console.log(`🔍 Current Net Worth API: Found ${accounts?.length ?? 0} accounts`);
  }

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      netWorth: 0,
      assets: 0,
      liabilities: 0,
      totalAccounts: 0,
      accountBreakdown: [],
      message: 'No accounts found for user',
    });
  }

  let totalAssets = 0;
  let totalLiabilities = 0;
  const accountBreakdown: AccountBreakdownEntry[] = [];

  accounts.forEach((account) => {
    const balances = (account.balances as { current?: number | null } | null) ?? null;
    const balance = Number(balances?.current ?? 0);

    const isLiability = isLiabilityAccount(account);

    const accountData: AccountBreakdownEntry = {
      accountId: account.id,
      accountName: account.name,
      accountType: account.subtype || account.type || null,
      balance,
      isLiability,
      lastUpdated: new Date().toISOString(),
      contribution: 0,
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

  if (DEBUG)
    console.log(
      `🔍 Current Net Worth API: Assets: $${totalAssets.toFixed(2)}, Liabilities: $${totalLiabilities.toFixed(2)}, Net Worth: $${netWorth.toFixed(2)}`
    );

  return NextResponse.json({
    netWorth: Math.round(netWorth * 100) / 100,
    assets: Math.round(totalAssets * 100) / 100,
    liabilities: Math.round(totalLiabilities * 100) / 100,
    totalAccounts: accounts.length,
    accountsWithBalances: accounts.filter((acc) => {
      const b = acc.balances as { current?: number | null } | null;
      return b?.current !== null && b?.current !== undefined;
    }).length,
    accountBreakdown,
    calculatedAt: new Date().toISOString(),
  });
});
