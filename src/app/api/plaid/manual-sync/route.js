import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../lib/logger';

const logger = createLogger('manual-sync-trigger');

export async function POST(request) {
  try {
    const { plaidItemId, includeHoldingsDebug = false } = await request.json();

    logger.info('Manual sync trigger requested', { plaidItemId, includeHoldingsDebug });

    if (!plaidItemId) {
      return Response.json(
        { error: 'plaidItemId is required' },
        { status: 400 }
      );
    }

    // Get the plaid item
    const { data: plaidItem, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .select('*')
      .eq('id', plaidItemId)
      .single();

    if (itemError || !plaidItem) {
      return Response.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    logger.info('Triggering sync for item', {
      item_id: plaidItem.item_id,
      user_id: plaidItem.user_id,
      products: plaidItem.products || []
    });

    const products = Array.isArray(plaidItem.products) ? plaidItem.products : [];
    const hasInvestmentsProduct = products.includes('investments');
    const hasTransactionsProduct = products.includes('transactions');
    const shouldRunTransactionsSync = hasTransactionsProduct || !hasInvestmentsProduct;

    const responsePayload = {
      success: true,
      item_id: plaidItem.item_id,
      products,
      transaction_sync: null,
      holdings_sync: null,
      investment_transactions_sync: null
    };

    if (shouldRunTransactionsSync) {
      const { POST: syncEndpoint } = await import('../transactions/sync/route.js');
      const syncRequest = {
        json: async () => ({
          plaidItemId: plaidItem.id,
          userId: plaidItem.user_id,
          forceSync: true
        })
      };
      const syncResponse = await syncEndpoint(syncRequest);
      const syncResult = await syncResponse.json();
      responsePayload.transaction_sync = {
        success: syncResponse.ok,
        ...syncResult
      };
      if (!syncResponse.ok) responsePayload.success = false;
    }

    if (hasInvestmentsProduct) {
      const { POST: holdingsSyncEndpoint } = await import('../investments/holdings/sync/route.js');
      const holdingsSyncRequest = {
        json: async () => ({
          plaidItemId: plaidItem.id,
          userId: plaidItem.user_id,
          forceSync: true,
          includeDebug: includeHoldingsDebug
        })
      };
      const holdingsSyncResponse = await holdingsSyncEndpoint(holdingsSyncRequest);
      const holdingsSyncResult = await holdingsSyncResponse.json();
      responsePayload.holdings_sync = {
        success: holdingsSyncResponse.ok,
        ...holdingsSyncResult
      };
      if (!holdingsSyncResponse.ok) responsePayload.success = false;

      const { POST: invTxSyncEndpoint } = await import('../investments/transactions/sync/route.js');
      const invTxSyncRequest = {
        json: async () => ({
          plaidItemId: plaidItem.id,
          userId: plaidItem.user_id,
          forceSync: true
        })
      };
      const invTxSyncResponse = await invTxSyncEndpoint(invTxSyncRequest);
      const invTxSyncResult = await invTxSyncResponse.json();
      responsePayload.investment_transactions_sync = {
        success: invTxSyncResponse.ok,
        ...invTxSyncResult
      };
      if (!invTxSyncResponse.ok) responsePayload.success = false;
    }

    logger.info('Manual sync completed', {
      item_id: plaidItem.item_id,
      success: responsePayload.success,
      has_transactions_sync: !!responsePayload.transaction_sync,
      has_holdings_sync: !!responsePayload.holdings_sync,
      has_investment_transactions_sync: !!responsePayload.investment_transactions_sync
    });
    await logger.flush();

    return Response.json(responsePayload);

  } catch (error) {
    logger.error('Error triggering manual sync', error);
    await logger.flush();

    return Response.json(
      { error: 'Failed to trigger sync', details: error.message },
      { status: 500 }
    );
  }
}
