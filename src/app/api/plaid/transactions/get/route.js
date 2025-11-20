import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limitParam = parseInt(searchParams.get('limit') || '0', 10);
    const minimal = (searchParams.get('minimal') || '1') === '1';
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : 20;

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('Fetching transactions for user:', userId, `(limit=${limit}, minimal=${minimal})`);

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
    const { data: transactions, error } = await supabaseAdmin
      .from('transactions')
      .select(selectFragment)
      .eq('accounts.user_id', userId)
      .order('datetime', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching transactions:', error);
      return Response.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // Transform the data to include account/category info for easier display
    const transformedTransactions = transactions.map((transaction) => ({
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
    });
  } catch (error) {
    console.error('Error in transactions GET API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
