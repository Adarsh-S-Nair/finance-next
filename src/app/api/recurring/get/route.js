import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/recurring/get
 * Retrieves recurring transaction streams for a user from the database.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const streamType = searchParams.get('streamType'); // 'inflow', 'outflow', or null for all

  if (!userId) {
    return Response.json({ error: 'User ID is required' }, { status: 400 });
  }

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

    // Enhance streams with icon_url from the most recent transaction
    const latestTransactionIds = streams
      .map(s => s.transaction_ids && s.transaction_ids.length > 0 ? s.transaction_ids[0] : null)
      .filter(Boolean);

    if (latestTransactionIds.length > 0) {
      // Query transactions using the Plaid transaction ID stored in transaction_ids array
      const { data: transactions } = await supabase
        .from('transactions')
        .select(`
          plaid_transaction_id, 
          icon_url,
          system_categories (
            category_groups (
              icon_lib,
              icon_name,
              hex_color
            )
          )
        `)
        .in('plaid_transaction_id', latestTransactionIds);

      if (transactions) {
        const txMap = new Map(transactions.map(t => [t.plaid_transaction_id, t]));

        // Attach icon_url and category metadata to streams
        streams.forEach(stream => {
          if (stream.transaction_ids && stream.transaction_ids.length > 0) {
            const latestId = stream.transaction_ids[0];
            const tx = txMap.get(latestId);

            if (tx) {
              stream.icon_url = tx.icon_url || null;
              stream.category_icon_lib = tx.system_categories?.category_groups?.icon_lib;
              stream.category_icon_name = tx.system_categories?.category_groups?.icon_name;
              stream.category_hex_color = tx.system_categories?.category_groups?.hex_color;
            }
          }
        });
      }
    }

    return Response.json({ recurring: streams });
  } catch (error) {
    console.error('Error fetching recurring streams:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
