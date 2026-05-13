/**
 * GET /api/plaid/debug/plaid-transactions?days=60
 *
 * Debug helper: calls Plaid's /transactions/get for the requesting
 * user's items over the past N days (default 60), diffs against what we
 * have locally, and returns a concise report. Useful for diagnosing
 * "transaction X should be there but isn't" without having to dump
 * production logs.
 *
 * Returns shape:
 *   {
 *     items: [
 *       {
 *         plaid_item_id, plaid_item_uuid,
 *         plaid_total, db_total,
 *         only_in_plaid: [{ transaction_id, date, description, amount, account_id }, ...],
 *         only_in_db: [{ plaid_transaction_id, date, description, amount, account_id }, ...],
 *       },
 *     ],
 *   }
 *
 * Auth: same user gate as the rest of /api/plaid/* — caller can only
 * inspect their own data. This endpoint is read-only; no writes.
 */
import { withAuth } from '../../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../../lib/supabase/admin';
import { getTransactions } from '../../../../../lib/plaid/client';
import { decryptPlaidToken } from '../../../../../lib/crypto/plaidTokens';

interface PlaidTxRaw {
  transaction_id?: string;
  date?: string | null;
  authorized_date?: string | null;
  name?: string | null;
  merchant_name?: string | null;
  amount?: number;
  account_id?: string;
}

export const GET = withAuth(
  'plaid:debug:transactions',
  async (request, userId) => {
    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '60', 10);
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 730) : 60;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const { data: plaidItems, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, item_id, access_token')
      .eq('user_id', userId);
    if (itemsError) {
      return Response.json(
        { error: 'Failed to fetch plaid items', detail: itemsError.message },
        { status: 500 },
      );
    }
    if (!plaidItems || plaidItems.length === 0) {
      return Response.json({ items: [], window: { startStr, endStr, days } });
    }

    const results: unknown[] = [];

    for (const item of plaidItems) {
      const { data: accountRows } = await supabaseAdmin
        .from('accounts')
        .select('id, account_id, name')
        .eq('plaid_item_id', item.id);
      const accountByPlaid = new Map(
        (accountRows ?? []).map((a) => [a.account_id, { uuid: a.id, name: a.name }]),
      );
      const accountUuids = (accountRows ?? []).map((a) => a.id);

      // What does Plaid currently say is on file for this window?
      let plaidTxs: PlaidTxRaw[] = [];
      let plaidError: string | null = null;
      try {
        const res = await getTransactions(
          decryptPlaidToken(item.access_token),
          startStr,
          endStr,
        );
        plaidTxs = (res.transactions ?? []) as unknown as PlaidTxRaw[];
      } catch (err) {
        const e = err as { response?: { data?: { error_message?: string } }; message?: string };
        plaidError = e.response?.data?.error_message || e.message || 'unknown';
      }

      // What do we have locally?
      const { data: localRows } = accountUuids.length
        ? await supabaseAdmin
            .from('transactions')
            .select('plaid_transaction_id, date, description, amount, account_id')
            .in('account_id', accountUuids)
            .gte('date', startStr)
            .lte('date', endStr)
        : { data: [] };
      const localList = (localRows ?? []).filter(
        (r): r is {
          plaid_transaction_id: string;
          date: string;
          description: string;
          amount: number;
          account_id: string;
        } => Boolean(r.plaid_transaction_id),
      );
      const localIds = new Set(localList.map((r) => r.plaid_transaction_id));
      const plaidIds = new Set(
        plaidTxs.map((t) => t.transaction_id).filter((id): id is string => Boolean(id)),
      );

      const onlyInPlaid = plaidTxs
        .filter((t) => t.transaction_id && !localIds.has(t.transaction_id))
        .map((t) => ({
          transaction_id: t.transaction_id,
          date: t.date ?? t.authorized_date ?? null,
          description: t.name ?? t.merchant_name ?? null,
          amount: t.amount,
          account_name: t.account_id ? accountByPlaid.get(t.account_id)?.name ?? null : null,
        }));
      const onlyInDb = localList
        .filter((r) => !plaidIds.has(r.plaid_transaction_id))
        .map((r) => ({
          plaid_transaction_id: r.plaid_transaction_id,
          date: r.date,
          description: r.description,
          amount: r.amount,
        }));

      results.push({
        plaid_item_uuid: item.id,
        plaid_item_id: item.item_id,
        plaid_error: plaidError,
        plaid_total: plaidTxs.length,
        db_total: localList.length,
        only_in_plaid_count: onlyInPlaid.length,
        only_in_db_count: onlyInDb.length,
        only_in_plaid: onlyInPlaid,
        only_in_db: onlyInDb,
      });
    }

    return Response.json({ items: results, window: { startStr, endStr, days } });
  },
);
