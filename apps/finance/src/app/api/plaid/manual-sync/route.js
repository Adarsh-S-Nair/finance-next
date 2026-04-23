import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { createLogger } from '../../../../lib/logger';
import { withAuth } from '../../../../lib/api/withAuth';
import { syncInvestmentTransactionsForItem } from '../../../../lib/plaid/investmentTransactionSync';

const logger = createLogger('manual-sync-trigger');

export const POST = withAuth('plaid:manual-sync', async (request, userId) => {
    const { plaidItemId, includeHoldingsDebug = false } = await request.json();

    logger.info('Manual sync trigger requested', { plaidItemId, includeHoldingsDebug, userId });

    if (!plaidItemId) {
      return Response.json(
        { error: 'plaidItemId is required' },
        { status: 400 }
      );
    }

    // Get the plaid item — scoped to the caller so users can only trigger
    // syncs on their own items.
    const { data: plaidItem, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .select('*')
      .eq('id', plaidItemId)
      .eq('user_id', userId)
      .maybeSingle();

    if (itemError || !plaidItem) {
      return Response.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    logger.info('Triggering sync for item', {
      item_id: plaidItem.item_id,
      user_id: userId,
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

    // Forward the verified userId via header so internal route handlers
    // pick it up through requireVerifiedUserId().
    const internalHeaders = new Headers({ 'x-user-id': userId });
    if (shouldRunTransactionsSync) {
      const { POST: syncEndpoint } = await import('../transactions/sync/route.js');
      const syncRequest = {
        headers: internalHeaders,
        json: async () => ({
          plaidItemId: plaidItem.id,
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
        headers: internalHeaders,
        json: async () => ({
          plaidItemId: plaidItem.id,
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

      try {
        const invTxSyncResult = await syncInvestmentTransactionsForItem({
          plaidItemId: plaidItem.id,
          userId,
          forceSync: true,
        });
        responsePayload.investment_transactions_sync = {
          success: true,
          ...invTxSyncResult,
        };
      } catch (invTxError) {
        responsePayload.investment_transactions_sync = {
          success: false,
          error: invTxError.message,
        };
        responsePayload.success = false;
      }
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
});
