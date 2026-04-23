import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { createLogger } from '../../../../lib/logger';
import { withAuth } from '../../../../lib/api/withAuth';
import { syncInvestmentTransactionsForItem } from '../../../../lib/plaid/investmentTransactionSync';

const logger = createLogger('sync-all');

interface RequestBody {
  forceSync?: boolean;
  includeHoldingsDebug?: boolean;
}

interface SyncSubResult {
  success: boolean;
  [key: string]: unknown;
}

interface ItemResult {
  success: boolean;
  transaction_sync: SyncSubResult | null;
  holdings_sync: SyncSubResult | null;
  investment_transactions_sync: SyncSubResult | null;
  error?: string;
}

export const POST = withAuth('plaid:sync-all', async (request, userId) => {
  const { forceSync = false, includeHoldingsDebug = false } =
    (await request.json()) as RequestBody;
  logger.info('Sync all items requested', { userId, forceSync, includeHoldingsDebug });

  const { data: plaidItems, error: itemsError } = await supabaseAdmin
    .from('plaid_items')
    .select('id, item_id, user_id, products')
    .eq('user_id', userId);
  if (itemsError) {
    logger.error('Failed to fetch plaid items', itemsError as unknown as Error);
    return Response.json({ error: 'Failed to fetch plaid items' }, { status: 500 });
  }
  if (!plaidItems || plaidItems.length === 0) {
    logger.info('No plaid items found for user', { userId });
    return Response.json({
      success: true,
      message: 'No plaid items to sync',
      itemsSynced: 0,
    });
  }
  logger.info('Starting sync for items', {
    userId,
    itemCount: plaidItems.length,
    forceSync,
  });

  const syncResults: ItemResult[] = [];
  let successCount = 0;
  let failCount = 0;

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
        should_run_holdings_sync: hasInvestmentsProduct,
      });
      const itemResult: ItemResult = {
        success: true,
        transaction_sync: null,
        holdings_sync: null,
        investment_transactions_sync: null,
      };
      const internalHeaders = new Headers({ 'x-user-id': userId });
      if (shouldRunTransactionsSync) {
        const { POST: txSyncEndpoint } = await import('../transactions/sync/route');
        const txSyncRequest = {
          headers: internalHeaders,
          json: async () => ({
            plaidItemId: item.id,
            forceSync,
          }),
        } as unknown as NextRequest;
        const txSyncResponse = await txSyncEndpoint(txSyncRequest, {
          params: Promise.resolve({}),
        });
        const txSyncResult = (await txSyncResponse.json()) as Record<string, unknown>;
        itemResult.transaction_sync = {
          success: txSyncResponse.ok,
          ...txSyncResult,
        };
        if (!txSyncResponse.ok) {
          itemResult.success = false;
        }
      }
      if (hasInvestmentsProduct) {
        const { POST: holdingsSyncEndpoint } = await import('../investments/holdings/sync/route');
        const holdingsSyncRequest = {
          headers: internalHeaders,
          json: async () => ({
            plaidItemId: item.id,
            forceSync,
            includeDebug: includeHoldingsDebug,
          }),
        } as unknown as NextRequest;
        const holdingsSyncResponse = await holdingsSyncEndpoint(holdingsSyncRequest, {
          params: Promise.resolve({}),
        });
        const holdingsSyncResult = (await holdingsSyncResponse.json()) as Record<string, unknown>;
        itemResult.holdings_sync = {
          success: holdingsSyncResponse.ok,
          ...holdingsSyncResult,
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
            ...(invTxSyncResult as unknown as Record<string, unknown>),
          };
        } catch (invTxError) {
          itemResult.investment_transactions_sync = {
            success: false,
            error: invTxError instanceof Error ? invTxError.message : String(invTxError),
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
        transaction_sync: null,
        holdings_sync: null,
        investment_transactions_sync: null,
        error: error instanceof Error ? error.message : String(error),
      });
      logger.error('Error syncing item', error as Error, { item_id: item.item_id });
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
