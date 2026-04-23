import { supabaseAdmin } from '../../../../../lib/supabase/admin';
import { withAuth } from '../../../../../lib/api/withAuth';

interface SyncResult {
  itemId: string;
  success: boolean;
  error?: string;
  transactionsSynced?: number;
  pendingTransactionsUpdated?: number;
}

export const POST = withAuth('plaid:transactions:sync-all', async (request, userId) => {
  console.log('Sync all transactions request for user:', userId);

  const { data: plaidItems, error: itemsError } = await supabaseAdmin
    .from('plaid_items')
    .select('*')
    .eq('user_id', userId)
    .eq('sync_status', 'idle');

  if (itemsError) {
    console.error('Error fetching plaid items:', itemsError);
    return Response.json({ error: 'Failed to fetch plaid items' }, { status: 500 });
  }

  if (!plaidItems || plaidItems.length === 0) {
    return Response.json({
      success: true,
      message: 'No plaid items found or all items are already syncing',
      items_synced: 0,
      total_items: 0,
    });
  }

  console.log(`Found ${plaidItems.length} plaid items to sync`);

  // Forward Authorization + cookie so the inner sync route's middleware sees
  // an authenticated request. (The original JS referenced an undeclared
  // `forwardHeaders` here — a latent ReferenceError that meant this route
  // was effectively broken in production. Mirroring reset-cursor's pattern.)
  const authHeader = request.headers.get('Authorization');
  const cookieHeader = request.headers.get('cookie');
  const forwardHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) forwardHeaders['Authorization'] = authHeader;
  if (cookieHeader) forwardHeaders['cookie'] = cookieHeader;

  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const host = request.headers.get('host');
  const baseUrl = `${protocol}://${host}`;

  const syncPromises = plaidItems.map(async (plaidItem): Promise<SyncResult> => {
    try {
      const syncResponse = await fetch(`${baseUrl}/api/plaid/transactions/sync`, {
        method: 'POST',
        headers: forwardHeaders,
        body: JSON.stringify({
          plaidItemId: plaidItem.id,
          userId,
          forceSync: false,
        }),
      });

      if (!syncResponse.ok) {
        const errorData = (await syncResponse.json()) as { error?: string };
        console.error(`Sync failed for item ${plaidItem.item_id}:`, errorData);
        return {
          itemId: plaidItem.item_id,
          success: false,
          error: errorData.error || 'Unknown error',
        };
      }

      const syncResult = (await syncResponse.json()) as {
        transactions_synced?: number;
        pending_transactions_updated?: number;
      };
      console.log(`Sync completed for item ${plaidItem.item_id}:`, syncResult);
      return {
        itemId: plaidItem.item_id,
        success: true,
        transactionsSynced: syncResult.transactions_synced || 0,
        pendingTransactionsUpdated: syncResult.pending_transactions_updated || 0,
      };
    } catch (error) {
      console.error(`Error syncing item ${plaidItem.item_id}:`, error);
      return {
        itemId: plaidItem.item_id,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const results = await Promise.all(syncPromises);

  const successfulSyncs = results.filter((r) => r.success);
  const failedSyncs = results.filter((r) => !r.success);
  const totalTransactionsSynced = successfulSyncs.reduce(
    (sum, r) => sum + (r.transactionsSynced || 0),
    0
  );
  const totalPendingUpdated = successfulSyncs.reduce(
    (sum, r) => sum + (r.pendingTransactionsUpdated || 0),
    0
  );

  console.log(
    `Sync all completed: ${successfulSyncs.length} successful, ${failedSyncs.length} failed`
  );

  return Response.json({
    success: true,
    items_synced: successfulSyncs.length,
    total_items: plaidItems.length,
    failed_items: failedSyncs.length,
    total_transactions_synced: totalTransactionsSynced,
    total_pending_updated: totalPendingUpdated,
    results,
  });
});
