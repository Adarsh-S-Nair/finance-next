import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limitParam = parseInt(searchParams.get('limit') || '0', 10);
    const minimal = (searchParams.get('minimal') || '1') === '1';
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

    // Search parameter
    const search = searchParams.get('search') || '';

    // Cursor-based pagination params
    const cursorDate = searchParams.get('cursorDate'); // date (YYYY-MM-DD)
    const cursorId = searchParams.get('cursorId'); // transaction id
    const direction = searchParams.get('direction') || 'forward'; // 'forward' (older) or 'backward' (newer)

    // Filter parameters
    const type = searchParams.get('type'); // 'income' or 'expense'
    const status = searchParams.get('status'); // 'pending' or 'completed'
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');
    const groupIds = searchParams.get('groupIds'); // comma-separated group IDs
    const categoryIds = searchParams.get('categoryIds'); // comma-separated category IDs
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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
        date,
        datetime,
        authorized_date,
        is_unmatched_transfer,
        accounts!inner (id, name, mask),
        system_categories!inner (
          label,
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

    // Get user's transactions from database by joining through accounts
    // Note: We use !inner join for system_categories if we need to filter by category group
    // But to be safe and allow uncategorized transactions to appear if not filtering by category,
    // we should use left join (default) unless filtering.
    // However, the select string above uses !inner which forces inner join.
    // If we want to allow uncategorized transactions when NOT filtering by category, we should remove !inner from select string if categories param is missing.
    // Actually, let's adjust the selectFragment dynamically.

    let finalSelectFragment = selectFragment;
    if (!groupIds && !categoryIds) {
      // Remove !inner if we are not filtering by categories to allow transactions with null category
      finalSelectFragment = finalSelectFragment.replace(/system_categories!inner/g, 'system_categories');
    }

    let query = supabaseAdmin
      .from('transactions')
      .select(finalSelectFragment)
      .eq('accounts.user_id', userId);

    // Apply search filter if search query is provided
    if (search && search.trim().length > 0) {
      const searchTerm = `%${search.trim()}%`;
      query = query.or(`merchant_name.ilike.${searchTerm},description.ilike.${searchTerm}`);
    }

    // Apply filters
    if (type === 'income') {
      query = query.gt('amount', 0);
    } else if (type === 'expense') {
      query = query.lt('amount', 0);
    }

    if (status === 'pending') {
      query = query.eq('pending', true);
    } else if (status === 'completed') {
      // pending can be null or false
      query = query.not('pending', 'is', true);
    } else if (status === 'attention') {
      // Filter for transactions needing attention: Unknown Account OR Unmatched Transfer
      // Cross-table OR is difficult in PostgREST, so we fetch unknown account IDs first.
      const { data: unknownAccounts, error: uaError } = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .is('name', null);

      if (uaError) {
        console.error('Error fetching unknown accounts for filter:', uaError);
      }

      const unknownAccountIds = unknownAccounts?.map(a => a.id) || [];

      if (unknownAccountIds.length > 0) {
        query = query.or(`is_unmatched_transfer.eq.true,account_id.in.(${unknownAccountIds.join(',')})`);
      } else {
        query = query.eq('is_unmatched_transfer', true);
      }
    }

    if (minAmount) {
      // Amount is stored as signed numeric.
      // For filtering by magnitude (e.g. $50-$100), we need to handle sign.
      // Usually users mean absolute value.
      // But SQL filtering on absolute value is hard without RPC.
      // If type is 'expense', amount is negative. minAmount 50 means amount <= -50.
      // If type is 'income', amount is positive. minAmount 50 means amount >= 50.
      // If type is 'all', it's tricky.
      // Let's assume the frontend sends the correct signed values OR we just filter absolute magnitude if possible.
      // But standard Supabase doesn't support abs() in filter.
      // Let's assume the frontend handles the sign logic if it can, OR we rely on the 'type' filter being set.
      // If 'type' is NOT set, filtering by amount range is ambiguous (is -100 > 50? No. Is |-100| > 50? Yes).
      // The frontend sends positive values for min/max.
      // If we want to support "Transactions > $50" (absolute), we need: amount > 50 OR amount < -50.
      // .or(`amount.gt.${minAmount},amount.lt.-${minAmount}`)

      const min = parseFloat(minAmount);
      query = query.or(`amount.gte.${min},amount.lte.-${min}`);
    }

    if (maxAmount) {
      const max = parseFloat(maxAmount);
      // amount <= max AND amount >= -max
      // We need AND logic here.
      // .lte('amount', max).gte('amount', -max)
      query = query.lte('amount', max).gte('amount', -max);
    }

    if (groupIds || categoryIds) {
      // If we have both, it's usually OR (in these groups OR in these categories)
      // But Supabase query builder chaining is AND by default.
      // To do OR, we need a complex filter string.
      // For simplicity, let's assume if both are present, we want transactions that match EITHER.
      // Or we can just chain them as ORs if possible.
      // Actually, standard UI usually implies "Show me transactions in Group A OR Category B".

      // We can use the `or` filter with foreign key syntax?
      // `system_categories.or(group_id.in.(${groupIds}),id.in.(${categoryIds}))`
      // This might work!

      if (groupIds && categoryIds) {
        const gIds = groupIds.split(',');
        const cIds = categoryIds.split(',');
        // We need to construct the filter string for system_categories
        // group_id.in.(a,b),id.in.(c,d)
        query = query.or(`group_id.in.(${gIds.join(',')}),id.in.(${cIds.join(',')})`, { foreignTable: 'system_categories' });
      } else if (groupIds) {
        const ids = groupIds.split(',');
        query = query.in('system_categories.group_id', ids);
      } else if (categoryIds) {
        const ids = categoryIds.split(',');
        query = query.in('category_id', ids);
      }
    }

    // Use 'date' column for filtering
    if (startDate) {
      // startDate is ISO string, extract YYYY-MM-DD
      const dateStr = startDate.split('T')[0];
      query = query.gte('date', dateStr);
    }
    if (endDate) {
      // endDate is ISO string, extract YYYY-MM-DD
      const dateStr = endDate.split('T')[0];
      query = query.lte('date', dateStr);
    }

    // Apply cursor-based pagination using 'date' column
    if (cursorDate && cursorId) {
      // cursorDate should be YYYY-MM-DD
      const dateStr = cursorDate.split('T')[0];

      if (direction === 'forward') {
        // Fetch older transactions (date < cursor OR (date = cursor AND id < cursorId))
        query = query.or(`date.lt.${dateStr},and(date.eq.${dateStr},id.lt.${cursorId})`);
      } else {
        // Fetch newer transactions (backward)
        // date > cursor OR (date = cursor AND id > cursorId)
        query = query.or(`date.gt.${dateStr},and(date.eq.${dateStr},id.gt.${cursorId})`);
      }
    }

    // Apply sorting using 'date' column
    if (direction === 'forward') {
      // Standard sort: Newest first
      query = query
        .order('date', { ascending: false })
        .order('id', { ascending: false });
    } else {
      // Backward sort: Oldest first (so we get the ones immediately preceding the cursor)
      // We will reverse this list before returning
      query = query
        .order('date', { ascending: true })
        .order('id', { ascending: true });
    }

    const { data: transactions, error } = await query.limit(limit);

    if (error) {
      console.error('Error fetching transactions:', error);
      return Response.json(
        { error: error.message || 'Failed to fetch transactions' },
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
      is_repayment: transaction.transaction_repayments && transaction.transaction_repayments.length > 0,
      // Preserve transaction.icon_url from DB; do not override with institution logo
    }));

    // --- Unmatched Transfer/Payment Detection ---
    // Now handled by persistent column `is_unmatched_transfer` populated during sync.
    // We map it to `is_unmatched_payment` for frontend compatibility.
    transformedTransactions.forEach(tx => {
      tx.is_unmatched_payment = tx.is_unmatched_transfer;
    });
    // -----------------------------------------------

    console.log(`Found ${transformedTransactions.length} transactions for user ${userId}`);

    return Response.json({
      transactions: transformedTransactions,
      count: transformedTransactions.length,
      limit,
      minimal,
      nextCursor: transformedTransactions.length > 0
        ? {
          date: transformedTransactions[transformedTransactions.length - 1].date,
          id: transformedTransactions[transformedTransactions.length - 1].id
        }
        : null,
      prevCursor: transformedTransactions.length > 0
        ? {
          date: transformedTransactions[0].date,
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
