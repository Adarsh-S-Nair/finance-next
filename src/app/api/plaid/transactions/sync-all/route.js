import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    console.log('Sync all transactions request for user:', userId);

    // Get all plaid items for the user
    const { data: plaidItems, error: itemsError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('user_id', userId)
      .eq('sync_status', 'idle'); // Only sync items that are not currently syncing

    if (itemsError) {
      console.error('Error fetching plaid items:', itemsError);
      return Response.json(
        { error: 'Failed to fetch plaid items' },
        { status: 500 }
      );
    }

    if (!plaidItems || plaidItems.length === 0) {
      return Response.json({
        success: true,
        message: 'No plaid items found or all items are already syncing',
        items_synced: 0,
        total_items: 0
      });
    }

    console.log(`Found ${plaidItems.length} plaid items to sync`);

    // Trigger sync for each plaid item
    const syncPromises = plaidItems.map(async (plaidItem) => {
      try {
        const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plaid/transactions/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plaidItemId: plaidItem.id,
            userId: userId,
            forceSync: false // Don't force sync if already syncing
          })
        });

        if (!syncResponse.ok) {
          const errorData = await syncResponse.json();
          console.error(`Sync failed for item ${plaidItem.item_id}:`, errorData);
          return {
            itemId: plaidItem.item_id,
            success: false,
            error: errorData.error || 'Unknown error'
          };
        }

        const syncResult = await syncResponse.json();
        console.log(`Sync completed for item ${plaidItem.item_id}:`, syncResult);
        return {
          itemId: plaidItem.item_id,
          success: true,
          transactionsSynced: syncResult.transactions_synced || 0,
          pendingTransactionsUpdated: syncResult.pending_transactions_updated || 0
        };
      } catch (error) {
        console.error(`Error syncing item ${plaidItem.item_id}:`, error);
        return {
          itemId: plaidItem.item_id,
          success: false,
          error: error.message
        };
      }
    });

    // Wait for all sync operations to complete
    const results = await Promise.all(syncPromises);

    // Calculate summary
    const successfulSyncs = results.filter(r => r.success);
    const failedSyncs = results.filter(r => !r.success);
    const totalTransactionsSynced = successfulSyncs.reduce((sum, r) => sum + (r.transactionsSynced || 0), 0);
    const totalPendingUpdated = successfulSyncs.reduce((sum, r) => sum + (r.pendingTransactionsUpdated || 0), 0);

    console.log(`Sync all completed: ${successfulSyncs.length} successful, ${failedSyncs.length} failed`);

    return Response.json({
      success: true,
      items_synced: successfulSyncs.length,
      total_items: plaidItems.length,
      failed_items: failedSyncs.length,
      total_transactions_synced: totalTransactionsSynced,
      total_pending_updated: totalPendingUpdated,
      results: results
    });

  } catch (error) {
    console.error('Error in sync all transactions:', error);
    return Response.json(
      { error: 'Failed to sync all transactions', details: error.message },
      { status: 500 }
    );
  }
}
