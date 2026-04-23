import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { createLogger } from '../../../../lib/logger';
import { withAuth } from '../../../../lib/api/withAuth';
import { syncInvestmentTransactionsForItem } from '../../../../lib/plaid/investmentTransactionSync';

const logger = createLogger('sync-all');
export const POST = withAuth('plaid:sync-all', async (request, userId) => {
    const { forceSync = false, includeHoldingsDebug = false } = await request.json();
    logger.info('Sync all items requested', { userId, forceSync, includeHoldingsDebug });
    // Get all plaid items for this user
    const { data: plaidItems, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, item_id, user_id, products')
      .eq('user_id', userId);
    if (itemsError) {
      logger.error('Failed to fetch plaid items', itemsError);
      return Response.json(
        { error: 'Failed to fetch plaid items' },
        { status: 500 }
      );
    }
    if (!plaidItems || plaidItems.length === 0) {
      logger.info('No plaid items found for user', { userId });
      return Response.json({
        success: true,
        message: 'No plaid items to sync',
        itemsSynced: 0,
      });
    }
    logger.info('Starting sync for items', { userId, itemCount: plaidItems.length, forceSync });
    const syncResults = [];
    let successCount = 0;
    let failCount = 0;
    // Sync each item
    for (const item of plaidItems) {
      try {
        const products = Array.isArray(item.products) ? item.products : [];
        const hasInvestmentsProduct = products.includes('investments');
        const hasTransactionsProduct = products.includes('transactions');
        const shouldRunTransactionsSync = hasTransactionsProduct || !hasInvestmentsProduct;
        logger.info('Syncing item', {
          item_id: item.item_id,
          products,
          should_run_transactions_sync: shouldRunTransactionsSync,
          should_run_holdings_sync: hasInvestmentsProduct
        });
        const itemResult = {
          success: true,
          transaction_sync: null,
          holdings_sync: null,
          investment_transactions_sync: null
        };
        const internalHeaders = new Headers({ 'x-user-id': userId });
        if (shouldRunTransactionsSync) {
          const { POST: txSyncEndpoint } = await import('../transactions/sync/route.js');
          const txSyncRequest = {
            headers: internalHeaders,
            json: async () => ({
              plaidItemId: item.id,
              forceSync
            })
          };
          const txSyncResponse = await txSyncEndpoint(txSyncRequest);
          const txSyncResult = await txSyncResponse.json();
          itemResult.transaction_sync = {
            success: txSyncResponse.ok,
            ...txSyncResult
          };
          if (!txSyncResponse.ok) {
            itemResult.success = false;
          }
        }
        if (hasInvestmentsProduct) {
          const { POST: holdingsSyncEndpoint } = await import('../investments/holdings/sync/route.js');
          const holdingsSyncRequest = {
            headers: internalHeaders,
            json: async () => ({
              plaidItemId: item.id,
              forceSync,
              includeDebug: includeHoldingsDebug
            })
          };
          const holdingsSyncResponse = await holdingsSyncEndpoint(holdingsSyncRequest);
          const holdingsSyncResult = await holdingsSyncResponse.json();
          itemResult.holdings_sync = {
            success: holdingsSyncResponse.ok,
            ...holdingsSyncResult
          };
          if (!holdingsSyncResponse.ok) {
            itemResult.success = false;
          }
          try {
            const invTxSyncResult = await syncInvestmentTransactionsForItem({
              plaidItemId: item.id,
              userId,
              forceSync,
            });
            itemResult.investment_transactions_sync = {
              success: true,
              ...invTxSyncResult,
            };
          } catch (invTxError) {
            itemResult.investment_transactions_sync = {
              success: false,
              error: invTxError.message,
            };
            itemResult.success = false;
          }
        }
        if (itemResult.success) {
          successCount++;
          logger.info('Item synced successfully', { item_id: item.item_id });
        } else {
          failCount++;
          logger.error('Item sync failed', null, { item_id: item.item_id, itemResult });
        }
        syncResults.push(itemResult);
      } catch (error) {
        failCount++;
        syncResults.push({
          success: false,
          error: error.message,
        });
        logger.error('Error syncing item', error, { item_id: item.item_id });
      }
    }
    logger.info('Sync all completed', {
      userId,
      totalItems: plaidItems.length,
      successCount,
      failCount,
    });
    await logger.flush();
    return Response.json({
      success: failCount === 0,
      itemsSynced: successCount,
      itemsFailed: failCount,
      results: syncResults,
    });
});
