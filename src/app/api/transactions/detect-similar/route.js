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

    // 3. Search for similar transactions
    // Criteria:
    // - Same merchant_name (if exists) OR same description (if merchant_name is null)
    // - Different category_id than the new one
    // - Same user_id (via accounts table)

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

    if (transaction.merchant_name) {
      query = query.eq('merchant_name', transaction.merchant_name);
    } else {
      query = query.eq('description', transaction.description);
    }

    // Limit to recent 50 to avoid massive payloads
    query = query.order('date', { ascending: false }).limit(50);

    const { data: similarTransactions, error: searchError } = await query;

    if (searchError) {
      logger.error('Error searching similar transactions', searchError);
      throw searchError;
    }

    // Transform data to match frontend expectations (flatten category info)
    const transformedTransactions = similarTransactions.map(tx => ({
      ...tx,
      category_name: tx.system_categories?.label,
      category_icon_lib: tx.system_categories?.category_groups?.icon_lib,
      category_icon_name: tx.system_categories?.category_groups?.icon_name,
      category_hex_color: tx.system_categories?.category_groups?.hex_color,
    }));

    // Determine match type for criteria
    const criteria = transaction.merchant_name
      ? { field: 'merchant_name', value: transaction.merchant_name, operator: 'is' }
      : { field: 'description', value: transaction.description, operator: 'contains' };

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
