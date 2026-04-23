import { createClient } from '@supabase/supabase-js';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { canAccess } from '../../../../lib/tierConfig';
import type { Database } from '../../../../types/database';

interface EnrichmentTx {
  id?: string;
  plaid_transaction_id?: string | null;
  merchant_name: string | null;
  icon_url: string | null;
  date: string | null;
  category_id: string | null;
  system_categories: {
    hex_color: string | null;
    category_groups: {
      icon_lib: string | null;
      icon_name: string | null;
      hex_color: string | null;
    } | null;
  } | null;
}

/**
 * GET /api/recurring/get
 * Retrieves recurring transaction streams for a user from the database.
 */
export const GET = withAuth('recurring:get', async (request, userId) => {
  // Check subscription tier — recurring is a Pro feature
  const { data: userProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();
  const subscriptionTier = userProfile?.subscription_tier || 'free';
  if (!canAccess(subscriptionTier, 'recurring')) {
    return Response.json({ error: 'feature_locked', feature: 'recurring' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const streamType = searchParams.get('streamType'); // 'inflow', 'outflow', or null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return Response.json({ error: 'Supabase env not configured' }, { status: 500 });
  }
  const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

  let query = supabase
    .from('recurring_streams')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('predicted_next_date', { ascending: true, nullsFirst: false });

  if (streamType && ['inflow', 'outflow'].includes(streamType)) {
    query = query.eq('stream_type', streamType);
  }

  const { data: streams, error: streamsError } = await query;

  if (streamsError) {
    throw streamsError;
  }

  // Enrichment fields are added dynamically — keep streams loosely typed for that.
  const enrichedStreams = (streams ?? []) as Array<
    (typeof streams extends ReadonlyArray<infer T> ? T : never) & {
      icon_url?: string | null;
      category_icon_lib?: string | null;
      category_icon_name?: string | null;
      category_hex_color?: string | null;
    }
  >;

  const merchantNames = enrichedStreams
    .map((s) => s.merchant_name)
    .filter((m): m is string => Boolean(m));

  const unnamedStreams = enrichedStreams.filter(
    (s) => !s.merchant_name && s.transaction_ids && s.transaction_ids.length > 0
  );
  const fallbackTransactionIds = unnamedStreams.map(
    (s) => s.transaction_ids[s.transaction_ids.length - 1]
  );

  if (merchantNames.length > 0 || fallbackTransactionIds.length > 0) {
    const { data: accounts } = await supabase
      .from('accounts')
      .select('id')
      .eq('user_id', userId);

    const accountIds = accounts?.map((a) => a.id) || [];

    if (accountIds.length > 0) {
      let transactionsByName: EnrichmentTx[] = [];
      let transactionsById: EnrichmentTx[] = [];

      if (merchantNames.length > 0) {
        const { data: txByName } = await supabase
          .from('transactions')
          .select(
            `
            merchant_name,
            icon_url,
            date,
            category_id,
            system_categories (
              hex_color,
              category_groups (
                icon_lib,
                icon_name,
                hex_color
              )
            )
          `
          )
          .in('account_id', accountIds)
          .in('merchant_name', merchantNames)
          .order('date', { ascending: false });

        if (txByName) transactionsByName = txByName as unknown as EnrichmentTx[];
      }

      if (fallbackTransactionIds.length > 0) {
        const { data: txById } = await supabase
          .from('transactions')
          .select(
            `
            id,
            plaid_transaction_id,
            merchant_name,
            icon_url,
            date,
            category_id,
            system_categories (
              hex_color,
              category_groups (
                icon_lib,
                icon_name,
                hex_color
              )
            )
          `
          )
          .in('plaid_transaction_id', fallbackTransactionIds);

        if (txById) transactionsById = txById as unknown as EnrichmentTx[];
      }

      if (transactionsByName.length > 0 || transactionsById.length > 0) {
        const merchantMap = new Map<string, EnrichmentTx>();
        transactionsByName.forEach((tx) => {
          if (tx.merchant_name && !merchantMap.has(tx.merchant_name.toLowerCase())) {
            merchantMap.set(tx.merchant_name.toLowerCase(), tx);
          }
        });

        const idMap = new Map<string, EnrichmentTx>();
        transactionsById.forEach((tx) => {
          if (tx.plaid_transaction_id) {
            idMap.set(tx.plaid_transaction_id, tx);
          }
        });

        enrichedStreams.forEach((stream) => {
          let tx: EnrichmentTx | null = null;

          if (stream.merchant_name) {
            tx = merchantMap.get(stream.merchant_name.toLowerCase()) ?? null;
          }

          if (!tx && stream.transaction_ids && stream.transaction_ids.length > 0) {
            const latestId = stream.transaction_ids[stream.transaction_ids.length - 1];
            tx = idMap.get(latestId) ?? null;
          }

          if (tx) {
            stream.icon_url = tx.icon_url || null;
            stream.category_icon_lib = tx.system_categories?.category_groups?.icon_lib;
            stream.category_icon_name = tx.system_categories?.category_groups?.icon_name;
            stream.category_hex_color =
              tx.system_categories?.hex_color || tx.system_categories?.category_groups?.hex_color;
          }
        });
      }
    }
  }

  return Response.json({ recurring: enrichedStreams });
});
