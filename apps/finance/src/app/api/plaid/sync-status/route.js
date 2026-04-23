/**
 * GET /api/plaid/sync-status
 *
 * Returns a snapshot of every Plaid item's sync state for the current user.
 * Used by the /setup/syncing splash page to poll until the initial Plaid
 * backfill completes (new FTUX connections land as items with no
 * last_transaction_sync and an 'idle' or 'syncing' status), and by the
 * accounts page to show a per-item "Syncing…" pill.
 *
 * An item counts as "ready" when it has both (a) finished at least one
 * sync attempt — success OR error — and (b) is not currently in a
 * 'syncing' state. This deliberately accepts errored items as "ready"
 * because we'd rather show the user their data (or an error) than keep
 * them on a splash screen indefinitely.
 *
 * Response shape:
 *   {
 *     ready: boolean,              // true when ALL items are ready
 *     itemsTotal: number,
 *     itemsReady: number,
 *     itemsSyncing: number,
 *     itemsError: number,
 *     items: Array<{
 *       id: string,
 *       sync_status: 'idle' | 'syncing' | 'error' | null,
 *       last_transaction_sync: string | null,
 *       last_balance_sync: string | null,
 *       last_error: string | null,
 *       ready: boolean,
 *     }>
 *   }
 *
 * No items at all → { ready: true, itemsTotal: 0, ... } so clients can
 * short-circuit to dashboard (or wherever) without polling forever.
 */

import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';

export const GET = withAuth('sync-status', async (request, userId) => {
  const { data: items, error } = await supabaseAdmin
    .from('plaid_items')
    .select('id, sync_status, last_transaction_sync, last_balance_sync, last_error')
    .eq('user_id', userId);

  if (error) {
    console.error('[sync-status] query failed:', error);
    return Response.json({ error: 'Failed to fetch sync status' }, { status: 500 });
  }

  const rows = items || [];

  const enriched = rows.map((it) => {
    const hasCompletedOnce =
      it.last_transaction_sync !== null ||
      it.last_balance_sync !== null ||
      it.sync_status === 'error';
    const isSyncing = it.sync_status === 'syncing';
    const ready = hasCompletedOnce && !isSyncing;
    return { ...it, ready };
  });

  const itemsReady = enriched.filter((i) => i.ready).length;
  const itemsSyncing = enriched.filter((i) => i.sync_status === 'syncing').length;
  const itemsError = enriched.filter((i) => i.sync_status === 'error').length;
  const itemsTotal = enriched.length;
  // Zero items → ready (nothing to wait on). This matters for users who
  // land on /setup/syncing with no pending work (e.g. direct nav).
  const ready = itemsTotal === 0 || itemsReady === itemsTotal;

  return Response.json({
    ready,
    itemsTotal,
    itemsReady,
    itemsSyncing,
    itemsError,
    items: enriched,
  });
});
