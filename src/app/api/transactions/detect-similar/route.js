import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../lib/logger';

const logger = createLogger('detect-similar');

export async function POST(request) {
  try {
    const { transactionId, categoryId, userId } = await request.json();

    if (!transactionId || !categoryId || !userId) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Fetch the source transaction
    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select('id, merchant_name, description, amount, account_id')
      .eq('id', transactionId)
      .single();

    if (fetchError || !transaction) {
      logger.error('Transaction not found', fetchError, { transactionId });
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // 2. Verify ownership via separate query to be safe and avoid join issues
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select('user_id')
      .eq('id', transaction.account_id)
      .single();

    if (accountError || !account || account.user_id !== userId) {
      logger.error('Unauthorized access to transaction', null, { transactionId, userId, accountUserId: account?.user_id });
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 3. Build base query for similar transactions
    const buildQuery = (includeAmount = false) => {
      let query = supabaseAdmin
        .from('transactions')
        .select(`
          id,
          date,
          merchant_name,
          description,
          amount,
          icon_url,
          category_id,
          accounts!inner (
            user_id
          ),
          system_categories (
            label,
            category_groups (
              icon_lib,
              icon_name,
              hex_color
            )
          )
        `)
        .eq('accounts.user_id', userId)
        .neq('id', transactionId)
        .neq('category_id', categoryId); // Exclude ones that already have this category

      // Match by merchant_name or description
      if (transaction.merchant_name) {
        query = query.eq('merchant_name', transaction.merchant_name);
      } else {
        query = query.eq('description', transaction.description);
      }

      // Optionally also match exact amount
      if (includeAmount) {
        query = query.eq('amount', transaction.amount);
      }

      return query.order('date', { ascending: false }).limit(50);
    };

    // 4. First try: Match name + exact amount (most specific)
    let { data: similarTransactions, error: searchError } = await buildQuery(true);

    if (searchError) {
      logger.error('Error searching similar transactions (exact)', searchError);
      throw searchError;
    }

    let matchType = 'exact'; // name + amount match

    // 5. If no exact matches, fall back to name-only matching
    if (!similarTransactions || similarTransactions.length === 0) {
      const { data: nameOnlyMatches, error: nameOnlyError } = await buildQuery(false);

      if (nameOnlyError) {
        logger.error('Error searching similar transactions (name only)', nameOnlyError);
        throw nameOnlyError;
      }

      similarTransactions = nameOnlyMatches || [];
      matchType = 'name'; // name-only match
    }

    // 6. Transform data to match frontend expectations (flatten category info)
    const transformedTransactions = similarTransactions.map(tx => ({
      ...tx,
      category_name: tx.system_categories?.label,
      category_icon_lib: tx.system_categories?.category_groups?.icon_lib,
      category_icon_name: tx.system_categories?.category_groups?.icon_name,
      category_hex_color: tx.system_categories?.category_groups?.hex_color,
    }));

    // 7. Determine match criteria for display
    // For merchant_name, we use exact match ('is')
    // For description, we suggest 'contains' for more flexible rule matching
    // even though we matched exactly in the query
    const criteria = {
      field: transaction.merchant_name ? 'merchant_name' : 'description',
      value: transaction.merchant_name || transaction.description,
      operator: transaction.merchant_name ? 'is' : 'contains', // 'is' for merchant_name, 'contains' for description
      matchType, // 'exact' or 'name'
      amount: matchType === 'exact' ? transaction.amount : null
    };

    return Response.json({
      count: transformedTransactions.length,
      transactions: transformedTransactions,
      criteria
    });

  } catch (error) {
    logger.error('Error in detect-similar', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

