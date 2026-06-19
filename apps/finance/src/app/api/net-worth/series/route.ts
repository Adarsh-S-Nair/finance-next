import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { NextResponse } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { resolveScope } from '../../../../lib/api/scope';
import { NET_WORTH_RANGES, type NetWorthRange } from '../../../../lib/netWorth/series';
import { buildSeriesForAccounts } from '../../../../lib/netWorth/buildSeries';

export const GET = withAuth('net-worth:series', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const rawRange = (searchParams.get('range') || 'ALL').toUpperCase();
  const range: NetWorthRange = (NET_WORTH_RANGES as string[]).includes(rawRange)
    ? (rawRange as NetWorthRange)
    : 'ALL';

  const scope = await resolveScope(request, userId);
  if (scope instanceof Response) return scope;

  const { data: accounts, error: accountsError } = await supabaseAdmin
    .from('accounts')
    .select('id, type, subtype, balances, plaid_balance_current, created_at')
    .in('user_id', scope.userIds);

  if (accountsError) {
    console.error('Error fetching accounts:', accountsError);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ data: [], range, points: 0 });
  }

  const built = await buildSeriesForAccounts(accounts, range, Date.now());
  return NextResponse.json(built);
});
