import { createClient } from '@supabase/supabase-js';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

/**
 * GET /api/recurring/get
 * Retrieves recurring transaction streams for a user from the database.
 */
export async function GET(request) {
  let userId;
  try {
    userId = requireVerifiedUserId(request);
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const streamType = searchParams.get('streamType'); // 'inflow', 'outflow', or null for all

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let query = supabase
      .from('recurring_streams')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('predicted_next_date', { ascending: true, nullsFirst: false });

    // Filter by stream type if specified
    if (streamType && ['inflow', 'outflow'].includes(streamType)) {
      query = query.eq('stream_type', streamType);
    }

    const { data: streams, error: streamsError } = await query;

    if (streamsError) {
      throw streamsError;
    }

    // Enhance streams with icon_url and category data
    const merchantNames = streams
      .map(s => s.merchant_name)
      .filter(Boolean);

    // Identify streams that need fallback (no merchant name but have IDs)
    const unnamedStreams = streams.filter(s => !s.merchant_name && s.transaction_ids && s.transaction_ids.length > 0);
    const fallbackTransactionIds = unnamedStreams.map(s => s.transaction_ids[s.transaction_ids.length - 1]);

    // Check if we have anything to enrich
    if (merchantNames.length > 0 || fallbackTransactionIds.length > 0) {
      // Get all user's accounts first (needed for transaction queries)
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId);

      const accountIds = accounts?.map(a => a.id) || [];

      if (accountIds.length > 0) {
        let transactionsByName = [];
        let transactionsById = [];

        // Fetch by Merchant Name
        if (merchantNames.length > 0) {
          const { data: txByName } = await supabase
            .from('transactions')
            .select(`
              merchant_name, 
              icon_url,
              date,
              category_id,
              system_categories (
                category_groups (
                  icon_lib,
                  icon_name,
                  hex_color
                )
              )
            `)
            .in('account_id', accountIds)
            .in('merchant_name', merchantNames)
            .order('date', { ascending: false });

          if (txByName) transactionsByName = txByName;
        }

        // Fetch by ID (for unnamed streams) - using PLAID transaction_id
        if (fallbackTransactionIds.length > 0) {
          const { data: txById } = await supabase
            .from('transactions')
            .select(`
              id,
              plaid_transaction_id,
              merchant_name, 
              icon_url,
              date,
              category_id,
              system_categories (
                category_groups (
                  icon_lib,
                  icon_name,
                  hex_color
                )
              )
            `)
            // The IDs in recurring_streams.transaction_ids are PLAID transaction IDs
            .in('plaid_transaction_id', fallbackTransactionIds);

          if (txById) transactionsById = txById;
        }

        if (transactionsByName.length > 0 || transactionsById.length > 0) {
          // Create maps
          const merchantMap = new Map();
          transactionsByName.forEach(tx => {
            if (tx.merchant_name && !merchantMap.has(tx.merchant_name.toLowerCase())) {
              merchantMap.set(tx.merchant_name.toLowerCase(), tx);
            }
          });

          const idMap = new Map();
          transactionsById.forEach(tx => {
            // Map using the PLAID transaction ID
            if (tx.plaid_transaction_id) {
              idMap.set(tx.plaid_transaction_id, tx);
            }
          });

          // Enrich streams
          streams.forEach(stream => {
            let tx = null;

            // 1. Try merchant name
            if (stream.merchant_name) {
              tx = merchantMap.get(stream.merchant_name.toLowerCase());
            }

            // 2. Try ID fallback (using Plaid Transaction ID)
            if (!tx && stream.transaction_ids && stream.transaction_ids.length > 0) {
              const latestId = stream.transaction_ids[stream.transaction_ids.length - 1];
              tx = idMap.get(latestId);
            }

            if (tx) {
              stream.icon_url = tx.icon_url || null;
              stream.category_icon_lib = tx.system_categories?.category_groups?.icon_lib;
              stream.category_icon_name = tx.system_categories?.category_groups?.icon_name;
              stream.category_hex_color = tx.system_categories?.category_groups?.hex_color;
            }
          });
        }
      }
    }

    return Response.json({ recurring: streams });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error fetching recurring streams:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
