import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limitParam = parseInt(searchParams.get('limit') || '0', 10);
    const minimal = (searchParams.get('minimal') || '1') === '1';
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

    // Cursor-based pagination params
    const cursorDate = searchParams.get('cursorDate'); // datetime
    const cursorId = searchParams.get('cursorId'); // transaction id
    const direction = searchParams.get('direction') || 'forward'; // 'forward' (older) or 'backward' (newer)

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('Fetching transactions for user:', userId, `(limit=${limit}, minimal=${minimal}, dir=${direction})`);

    // Build a minimal-select by default to reduce payload size significantly
    const selectFragment = minimal
      ? `
        id,
        amount,
        pending,
        icon_url,
        merchant_name,
        description,
        datetime,
        accounts!inner (id, name, mask),
        system_categories (
          label,
          category_groups (
            icon_lib,
            icon_name,
            hex_color
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
        system_categories (
          id,
          label,
          category_groups (
            id,
            name,
            icon_lib,
            icon_name,
            hex_color
          )
        )
      `;

    // Get user's transactions from database by joining through accounts
    let query = supabaseAdmin
      .from('transactions')
      .select(selectFragment)
      .eq('accounts.user_id', userId);

    // Apply cursor-based pagination
    if (cursorDate && cursorId) {
      if (direction === 'forward') {
        // Fetch older transactions (datetime < cursor OR (datetime = cursor AND id < cursorId))
        // Since Supabase doesn't support tuple comparison easily in JS client, we use this logic:
        // We want items that appear AFTER the cursor in the sort order (DESC).
        // Sort order is datetime DESC, created_at DESC (using created_at as tie breaker if id is not sequential/reliable, but id is usually UUID. Let's use datetime and id for stability if id is sortable, or just datetime and created_at).
        // The original code used `order('datetime', { ascending: false }).order('created_at', { ascending: false })`.
        // Let's stick to that sort order.
        // To get the "next" page (older items), we need items with datetime <= cursorDate.
        // Ideally we use row-value comparison, but here we can filter:
        // datetime < cursorDate OR (datetime = cursorDate AND created_at < cursorCreatedAt)
        // To simplify, let's just use datetime for now, but that might miss items with same datetime.
        // A robust way is using the `lt` filter on a composite index, but Supabase JS client is limited.
        // Let's try to use the RPC or just simple filtering.
        // Actually, we can use `.lt('datetime', cursorDate)` but that misses same-time items.
        // For simplicity and robustness with the JS client, let's use a filter that might over-fetch slightly or use a raw query if needed.
        // But wait, we can chain `.or`.
        // `and(datetime.eq.${cursorDate},id.lt.${cursorId}),datetime.lt.${cursorDate}`

        // Let's assume we pass the exact datetime string.
        query = query.or(`datetime.lt.${cursorDate},and(datetime.eq.${cursorDate},id.lt.${cursorId})`);
      } else {
        // Fetch newer transactions (backward)
        // We want items appearing BEFORE the cursor in the sort order.
        // i.e. datetime > cursor OR (datetime = cursor AND id > cursorId)
        query = query.or(`datetime.gt.${cursorDate},and(datetime.eq.${cursorDate},id.gt.${cursorId})`);
      }
    }

    // Apply sorting
    if (direction === 'forward') {
      // Standard sort: Newest first
      query = query
        .order('datetime', { ascending: false })
        .order('id', { ascending: false });
    } else {
      // Backward sort: Oldest first (so we get the ones immediately preceding the cursor)
      // We will reverse this list before returning
      query = query
        .order('datetime', { ascending: true })
        .order('id', { ascending: true });
    }

    const { data: transactions, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching transactions:', error);
      return Response.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // If backward, we need to reverse the array to restore correct order (Newest -> Oldest)
    const orderedTransactions = direction === 'backward'
      ? (transactions || []).reverse()
      : (transactions || []);

    // Transform the data to include account/category info for easier display
    const transformedTransactions = orderedTransactions.map((transaction) => ({
      ...transaction,
      account_name: transaction.accounts?.name || 'Unknown Account',
      category_icon_lib: transaction.system_categories?.category_groups?.icon_lib || null,
      category_icon_name: transaction.system_categories?.category_groups?.icon_name || null,
      category_hex_color: transaction.system_categories?.category_groups?.hex_color || null,
      category_name: transaction.system_categories?.label || null,
      // Preserve transaction.icon_url from DB; do not override with institution logo
    }));

    console.log(`Found ${transformedTransactions.length} transactions for user ${userId}`);

    return Response.json({
      transactions: transformedTransactions,
      count: transformedTransactions.length,
      limit,
      minimal,
      nextCursor: transformedTransactions.length > 0
        ? {
          date: transformedTransactions[transformedTransactions.length - 1].datetime,
          id: transformedTransactions[transformedTransactions.length - 1].id
        }
        : null,
      prevCursor: transformedTransactions.length > 0
        ? {
          date: transformedTransactions[0].datetime,
          id: transformedTransactions[0].id
        }
        : null,
    });
  } catch (error) {
    console.error('Error in transactions GET API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
