import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { isLiabilityAccount } from '../../../../lib/accountUtils';
const DEBUG =
  process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

interface DayBucket {
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  accountBalances: Record<string, number>;
}

export const GET = withAuth('net-worth:dates', async (_request, userId) => {
  if (DEBUG) console.log(`🔍 Dates API: Getting unique dates for user ${userId}`);

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, name, type, subtype')
    .eq('user_id', userId);

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }

  if (DEBUG) console.log(`🔍 Dates API: Found ${accounts?.length ?? 0} accounts`);

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({
      message: 'No accounts found for user',
      uniqueDates: [],
      totalSnapshots: 0,
    });
  }

  const accountIds = accounts.map((account) => account.id);

  const { data: snapshots, error: snapshotsError } = await supabaseAdmin
    .from('account_snapshots')
    .select('recorded_at, current_balance, account_id')
    .in('account_id', accountIds)
    .order('recorded_at', { ascending: true });

  if (snapshotsError) {
    console.error('Error fetching snapshots:', snapshotsError);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }

  if (DEBUG) console.log(`🔍 Dates API: Found ${snapshots?.length ?? 0} total snapshots`);

  const netWorthByDate: Record<string, DayBucket> = {};

  (snapshots ?? []).forEach((snapshot) => {
    const date = new Date(snapshot.recorded_at).toISOString().split('T')[0];
    const account = accounts.find((acc) => acc.id === snapshot.account_id);
    if (!account) return;

    if (!netWorthByDate[date]) {
      netWorthByDate[date] = {
        date,
        assets: 0,
        liabilities: 0,
        netWorth: 0,
        accountBalances: {},
      };
    }

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

  Object.values(netWorthByDate).forEach((dayData) => {
    dayData.netWorth = dayData.assets - dayData.liabilities;
  });

  const uniqueDates = Object.values(netWorthByDate).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (DEBUG) {
    console.log(`🔍 Dates API: Generated ${uniqueDates.length} unique dates`);
    console.log(`🔍 Dates API: Sample dates:`, uniqueDates.slice(0, 1));
  }

  return NextResponse.json({
    data: uniqueDates,
    totalSnapshots: snapshots?.length ?? 0,
    totalAccounts: accounts.length,
  });
});
