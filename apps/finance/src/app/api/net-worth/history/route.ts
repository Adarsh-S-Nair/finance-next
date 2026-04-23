import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { isLiabilityAccount } from '../../../../lib/accountUtils';
const DEBUG =
  process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

interface HistoryDay {
  date: string;
  assets: number;
  liabilities: number;
  netWorth: number;
  accountBalances: Record<string, number>;
}

export const GET = withAuth('net-worth:history', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get('months') || '12');

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);

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

  const accountIds = accounts.map((account) => account.id);

  const { data: allSnapshots, error: allSnapshotsError } = await supabaseAdmin
    .from('account_snapshots')
    .select('account_id, current_balance, recorded_at')
    .in('account_id', accountIds)
    .order('recorded_at', { ascending: true });

  if (allSnapshotsError) {
    console.error('Error fetching all snapshots:', allSnapshotsError);
    return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
  }

  const initialBalances: Record<string, number> = {};
  (allSnapshots ?? []).forEach((snapshot) => {
    if (initialBalances[snapshot.account_id] === undefined) {
      initialBalances[snapshot.account_id] = toNumber(snapshot.current_balance);
    }
  });

  if (DEBUG) {
    console.log('🔍 Net worth history snapshots:', allSnapshots?.length ?? 0);
    console.log('🔍 Net worth history initial balances:', initialBalances);
  }

  const snapshotsByDate: Record<string, Record<string, number | null>> = {};
  (allSnapshots ?? []).forEach((snapshot) => {
    const date = toISODateString(new Date(snapshot.recorded_at));
    if (!snapshotsByDate[date]) snapshotsByDate[date] = {};
    snapshotsByDate[date][snapshot.account_id] = snapshot.current_balance;
  });

  const netWorthHistory: HistoryDay[] = [];
  const currentBalances: Record<string, number> = { ...initialBalances };

  const currentDate = new Date(startDate);
  const endDateTime = endDate.getTime();

  while (currentDate.getTime() <= endDateTime) {
    const dateStr = toISODateString(currentDate);

    if (snapshotsByDate[dateStr]) {
      Object.entries(snapshotsByDate[dateStr]).forEach(([accountId, balance]) => {
        currentBalances[accountId] = toNumber(balance);
      });
    }

    let assets = 0;
    let liabilities = 0;
    const accountBalances: Record<string, number> = {};

    accounts.forEach((account) => {
      const balance = toNumber(currentBalances[account.id]);
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
      accountBalances,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  if (DEBUG) {
    console.log(`🔍 API Debug: Generated ${netWorthHistory.length} daily net worth data points`);
    console.log(`🔍 API Debug: Initial Balances:`, initialBalances);
  }

  return NextResponse.json({ data: netWorthHistory });
});
