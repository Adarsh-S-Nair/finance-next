import { supabaseAdmin } from '../../../lib/supabaseAdmin';
const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit')) || 25; // Default to 25 transactions
    const offset = parseInt(searchParams.get('offset')) || 0; // Default to 0 for pagination
    const afterId = searchParams.get('afterId'); // For loading older transactions
    const beforeId = searchParams.get('beforeId'); // For loading newer transactions

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (DEBUG) console.log(`Transactions API: user=${userId} limit=${limit} offset=${offset} afterId=${afterId} beforeId=${beforeId}`);

    // Build the query
    let query = supabaseAdmin
      .from('transactions')
      .select(`
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
      `)
      .eq('accounts.user_id', userId)
      .order('datetime', { ascending: false })
      .order('created_at', { ascending: false });

    // If afterId is provided, get transactions after that ID (older transactions)
    if (afterId) {
      // Older window fetch
      
      // Get the datetime of the transaction with afterId to filter older transactions
      const { data: afterTransaction, error: afterError } = await supabase
        .from('transactions')
        .select('datetime, created_at')
        .eq('id', afterId)
        .single();

      // Reduce verbose logging

      if (afterTransaction) {
        // Get transactions that are older (earlier datetime) than the afterId transaction
        const filterQuery = `datetime.lt.${afterTransaction.datetime},and(datetime.eq.${afterTransaction.datetime},created_at.lt.${afterTransaction.created_at})`;
        // Reduced logging
        
        query = query
          .or(filterQuery)
          .limit(limit);
      } else {
        // If afterId not found, return empty result
        // afterId not found, returning empty result
        query = query.limit(0);
      }
    } else if (beforeId) {
      // Newer window fetch
      
      // Get the datetime of the transaction with beforeId to filter newer transactions (contiguous page above current)
      const { data: beforeTransaction, error: beforeError } = await supabase
        .from('transactions')
        .select('datetime, created_at')
        .eq('id', beforeId)
        .single();

      // Reduce verbose logging

      if (beforeTransaction) {
        // Get transactions that are newer (later datetime) than the beforeId transaction
        // We order ASC first to get the immediate next items after the boundary, then reverse before returning
        const filterQuery = `datetime.gt.${beforeTransaction.datetime},and(datetime.eq.${beforeTransaction.datetime},created_at.gt.${beforeTransaction.created_at})`;
        // Reduced logging

        // Rebuild query with ascending order for contiguous slice above current window
        query = supabase
          .from('transactions')
          .select(`
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
      `)
          .eq('accounts.user_id', userId)
          .or(filterQuery)
          .order('datetime', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(limit);
      } else {
        // If beforeId not found, return empty result
        // beforeId not found, returning empty result
        query = query.limit(0);
      }
    } else {
      // Standard offset-based pagination for initial load
      // Standard offset-based pagination
      query = query.range(offset, offset + limit - 1);
    }

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching transactions:', error);
      return Response.json(
        { error: 'Failed to fetch transactions' },
        { status: 500 }
      );
    }

    // For newer-page fetch (beforeId), reverse to descending order after querying ascending for contiguity
    const orderedTransactions = beforeId ? (transactions || []).slice().reverse() : transactions;

    // Transform the data to include account name and icon information for easier display
    const transformedTransactions = orderedTransactions.map(transaction => ({
      ...transaction,
      account_name: transaction.accounts?.name || 'Unknown Account',
      institution_name: transaction.accounts?.institutions?.name || 'Unknown Institution',
      category_icon_lib: transaction.system_categories?.category_groups?.icon_lib || null,
      category_icon_name: transaction.system_categories?.category_groups?.icon_name || null,
      category_hex_color: transaction.system_categories?.category_groups?.hex_color || null,
      category_name: transaction.system_categories?.label || null
    }));

    if (DEBUG) console.log(`Transactions API: returned=${transformedTransactions.length}`);

    // Check if there are more transactions available in the requested direction
    const hasMore = transformedTransactions.length === limit;
    const hasMoreNewer = !!beforeId && hasMore;
    const hasMoreOlder = !!afterId && hasMore;
    
    return Response.json({ 
      transactions: transformedTransactions,
      count: transformedTransactions.length,
      hasMore,
      hasMoreNewer,
      hasMoreOlder,
      limit,
      offset,
      afterId: afterId || null,
      beforeId: beforeId || null
    });
  } catch (error) {
    console.error('Error in transactions GET API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
