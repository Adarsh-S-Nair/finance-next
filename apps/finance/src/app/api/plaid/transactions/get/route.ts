import { supabaseAdmin } from '../../../../../lib/supabase/admin';
import { withAuth } from '../../../../../lib/api/withAuth';

export const GET = withAuth('transactions:get', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const limitParam = parseInt(searchParams.get('limit') || '0', 10);
  const minimal = (searchParams.get('minimal') || '1') === '1';
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

  const search = searchParams.get('search') || '';

  const cursorDate = searchParams.get('cursorDate');
  const cursorId = searchParams.get('cursorId');
  const direction = searchParams.get('direction') || 'forward';

  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const minAmount = searchParams.get('minAmount');
  const maxAmount = searchParams.get('maxAmount');
  const groupIds = searchParams.get('groupIds');
  const categoryIds = searchParams.get('categoryIds');
  const accountId = searchParams.get('accountId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  console.log(
    'Fetching transactions for user:',
    userId,
    `(limit=${limit}, minimal=${minimal}, dir=${direction})`
  );

  const selectFragment = minimal
    ? `
        id,
        amount,
        pending,
        icon_url,
        merchant_name,
        description,
        date,
        datetime,
        authorized_date,
        is_unmatched_transfer,
        transaction_source,
        investment_details,
        accounts!inner (id, name, mask),
        system_categories!inner (
          label,
          hex_color,
          group_id,
          category_groups (
            icon_lib,
            icon_name,
            hex_color
          )
        ),
        transaction_splits (
          id,
          amount,
          is_settled,
          contacts (
            name
          )
        ),
        transaction_repayments (
          id,
          amount,
          transaction_splits (
            transactions (
              id,
              description,
              date
            )
          )
        )
      `
    : `
        *,
        accounts!inner (
          id,
          name,
          mask,
          type,
          user_id,
          institutions (
            id,
            name,
            logo
          )
        ),
        system_categories!inner (
          id,
          label,
          hex_color,
          group_id,
          category_groups (
            id,
            name,
            icon_lib,
            icon_name,
            hex_color
          )
        ),
        transaction_splits (
          id,
          amount,
          is_settled,
          contacts (
            name
          )
        ),
        transaction_repayments (
          id,
          amount,
          transaction_splits (
            transactions (
              id,
              description,
              date
            )
          )
        )
      `;

  let finalSelectFragment = selectFragment;
  if (!groupIds && !categoryIds) {
    finalSelectFragment = finalSelectFragment.replace(
      /system_categories!inner/g,
      'system_categories'
    );
  }

  let query = supabaseAdmin
    .from('transactions')
    .select(finalSelectFragment)
    .eq('accounts.user_id', userId);

  // accountId may be a single id or a comma-separated list (multi-select).
  if (accountId) {
    const accountIds = accountId.split(',').filter(Boolean);
    if (accountIds.length === 1) {
      query = query.eq('account_id', accountIds[0]);
    } else if (accountIds.length > 1) {
      query = query.in('account_id', accountIds);
    }
  }

  // Drop investment "bookkeeping" rows with no cash impact (Plaid's
  // $0.00 "Allocate shares for …" share-assignment entries). A real
  // buy/sell/dividend/fee always carries a nonzero amount, so filtering
  // investment-source rows on amount=0 hides the noise without touching
  // ordinary $0 transactions (whose transaction_source is null).
  query = query.or('transaction_source.is.null,transaction_source.neq.investments,amount.neq.0');

  if (search && search.trim().length > 0) {
    const searchTerm = `%${search.trim()}%`;
    query = query.or(`merchant_name.ilike.${searchTerm},description.ilike.${searchTerm}`);
  }

  if (type === 'income') {
    query = query.gt('amount', 0);
  } else if (type === 'expense') {
    query = query.lt('amount', 0);
  }

  if (status === 'pending') {
    query = query.eq('pending', true);
  } else if (status === 'completed') {
    query = query.not('pending', 'is', true);
  } else if (status === 'attention') {
    const { data: unknownAccounts, error: uaError } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .is('name', null);

    if (uaError) {
      console.error('Error fetching unknown accounts for filter:', uaError);
    }

    const unknownAccountIds = unknownAccounts?.map((a) => a.id) || [];

    if (unknownAccountIds.length > 0) {
      query = query.or(
        `is_unmatched_transfer.eq.true,account_id.in.(${unknownAccountIds.join(',')})`
      );
    } else {
      query = query.eq('is_unmatched_transfer', true);
    }
  }

  if (minAmount) {
    const min = parseFloat(minAmount);
    query = query.or(`amount.gte.${min},amount.lte.-${min}`);
  }

  if (maxAmount) {
    const max = parseFloat(maxAmount);
    query = query.lte('amount', max).gte('amount', -max);
  }

  if (groupIds || categoryIds) {
    if (groupIds && categoryIds) {
      const gIds = groupIds.split(',');
      const cIds = categoryIds.split(',');
      query = query.or(
        `group_id.in.(${gIds.join(',')}),id.in.(${cIds.join(',')})`,
        { foreignTable: 'system_categories' }
      );
    } else if (groupIds) {
      const ids = groupIds.split(',');
      query = query.in('system_categories.group_id', ids);
    } else if (categoryIds) {
      const ids = categoryIds.split(',');
      query = query.in('category_id', ids);
    }
  }

  if (startDate) {
    const dateStr = startDate.split('T')[0];
    query = query.gte('date', dateStr);
  }
  if (endDate) {
    const dateStr = endDate.split('T')[0];
    query = query.lte('date', dateStr);
  }

  if (cursorDate && cursorId) {
    const dateStr = cursorDate.split('T')[0];

    if (direction === 'forward') {
      query = query.or(`date.lt.${dateStr},and(date.eq.${dateStr},id.lt.${cursorId})`);
    } else {
      query = query.or(`date.gt.${dateStr},and(date.eq.${dateStr},id.gt.${cursorId})`);
    }
  }

  if (direction === 'forward') {
    query = query.order('date', { ascending: false }).order('id', { ascending: false });
  } else {
    query = query.order('date', { ascending: true }).order('id', { ascending: true });
  }

  const { data: transactions, error } = await query.limit(limit);

  if (error) {
    console.error('Error fetching transactions:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch transactions' },
      { status: 500 }
    );
  }

  interface ResultTx {
    id: string;
    date: string | null;
    accounts?: { name?: string | null } | null;
    system_categories?: {
      label?: string | null;
      hex_color?: string | null;
      category_groups?: {
        icon_lib?: string | null;
        icon_name?: string | null;
        hex_color?: string | null;
      } | null;
    } | null;
    transaction_repayments?: { id: string }[];
    is_unmatched_transfer?: boolean | null;
    transaction_source?: string | null;
    icon_url?: string | null;
    investment_details?: { ticker?: string | null } | null;
    [key: string]: unknown;
  }

  const orderedTransactions =
    direction === 'backward'
      ? ((transactions ?? []) as unknown as ResultTx[]).reverse()
      : ((transactions ?? []) as unknown as ResultTx[]);

  const transformedTransactions = orderedTransactions.map((transaction) => ({
    ...transaction,
    account_name: transaction.accounts?.name || 'Unknown Account',
    category_icon_lib: transaction.system_categories?.category_groups?.icon_lib || null,
    category_icon_name: transaction.system_categories?.category_groups?.icon_name || null,
    category_hex_color:
      transaction.system_categories?.hex_color ||
      transaction.system_categories?.category_groups?.hex_color ||
      null,
    category_name: transaction.system_categories?.label || null,
    is_repayment:
      transaction.transaction_repayments && transaction.transaction_repayments.length > 0,
    is_unmatched_payment: transaction.is_unmatched_transfer ?? null,
  }));

  // Enrich investment transactions with company logos. They don't carry a
  // merchant icon_url like ordinary transactions, but their ticker maps to
  // a logo we already store in the `tickers` table (populated by holdings
  // sync). One lookup per page, keyed by symbol.
  const tickerSymbols = Array.from(
    new Set(
      transformedTransactions
        .filter((t) => t.transaction_source === 'investments' && !t.icon_url)
        .map((t) => t.investment_details?.ticker)
        .filter((s): s is string => Boolean(s)),
    ),
  );

  if (tickerSymbols.length > 0) {
    const { data: tickerRows, error: tickerErr } = await supabaseAdmin
      .from('tickers')
      .select('symbol, logo')
      .in('symbol', tickerSymbols);

    if (tickerErr) {
      console.error('Error fetching ticker logos:', tickerErr);
    } else {
      const logoBySymbol = new Map(
        (tickerRows ?? [])
          .filter((r) => r.logo && r.logo.trim() !== '')
          .map((r) => [r.symbol, r.logo]),
      );
      for (const t of transformedTransactions) {
        if (t.transaction_source !== 'investments' || t.icon_url) continue;
        const ticker = t.investment_details?.ticker;
        const logo = ticker ? logoBySymbol.get(ticker) : null;
        if (logo) t.icon_url = logo;
      }
    }
  }

  console.log(`Found ${transformedTransactions.length} transactions for user ${userId}`);

  return Response.json({
    transactions: transformedTransactions,
    count: transformedTransactions.length,
    limit,
    minimal,
    nextCursor:
      transformedTransactions.length > 0
        ? {
            date: transformedTransactions[transformedTransactions.length - 1].date,
            id: transformedTransactions[transformedTransactions.length - 1].id,
          }
        : null,
    prevCursor:
      transformedTransactions.length > 0
        ? {
            date: transformedTransactions[0].date,
            id: transformedTransactions[0].id,
          }
        : null,
  });
});
