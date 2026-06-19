/**
 * GET /api/investments/series?range=1D|1W|1M|3M|YTD|1Y|ALL
 *
 * Fixed, evenly-spaced time-series of the user's aggregated investment value,
 * with intraday resolution for short ranges. Shares the holdings-pricing engine
 * with /api/net-worth/series — here we pass only investment accounts, so the
 * assembled value is total holdings value (no liabilities).
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';
import { NET_WORTH_RANGES, type NetWorthRange } from '../../../../lib/netWorth/series';
import { buildSeriesForAccounts } from '../../../../lib/netWorth/buildSeries';

export const GET = withAuth('investments:series', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const rawRange = (searchParams.get('range') || 'ALL').toUpperCase();
  const range: NetWorthRange = (NET_WORTH_RANGES as string[]).includes(rawRange)
    ? (rawRange as NetWorthRange)
    : 'ALL';

  const { data: accounts, error } = await supabaseAdmin
    .from('accounts')
    .select('id, type, subtype, balances, plaid_balance_current, created_at')
    .eq('user_id', userId)
    .eq('type', 'investment');

  if (error) {
    console.error('Error fetching investment accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ data: [], range, points: 0 });
  }

  const built = await buildSeriesForAccounts(accounts, range, Date.now());

  // The assembled `netWorth` is total holdings value (investment accounts only,
  // no liabilities). Expose it as `value` to match the investments chart.
  return NextResponse.json({
    data: built.data.map((p) => ({ date: p.date, value: p.netWorth })),
    range: built.range,
    points: built.points,
    intraday: built.intraday,
    holdingsPriced: built.holdingsPriced,
  });
});
