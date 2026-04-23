import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { createLogger } from '../../../../lib/logger';
import { withAuth } from '../../../../lib/api/withAuth';
import { syncInvestmentTransactionsForItem } from '../../../../lib/plaid/investmentTransactionSync';

const logger = createLogger('manual-sync-trigger');

interface ManualSyncBody {
  plaidItemId?: string | null;
  includeHoldingsDebug?: boolean;
}

interface SyncSubResult {
  success: boolean;
  [key: string]: unknown;
}

interface ResponsePayload {
  success: boolean;
  item_id: string;
  products: string[];
  transaction_sync: SyncSubResult | null;
  holdings_sync: SyncSubResult | null;
  investment_transactions_sync: SyncSubResult | null;
}

export const POST = withAuth('plaid:manual-sync', async (request, userId) => {
  const { plaidItemId, includeHoldingsDebug = false } = (await request.json()) as ManualSyncBody;

  logger.info('Manual sync trigger requested', { plaidItemId, includeHoldingsDebug, userId });

  if (!plaidItemId) {
    return Response.json({ error: 'plaidItemId is required' }, { status: 400 });
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
    return Response.json({ error: 'Plaid item not found' }, { status: 404 });
  }

  logger.info('Triggering sync for item', {
    item_id: plaidItem.item_id,
    user_id: userId,
    products: plaidItem.products || [],
  });

  const products = Array.isArray(plaidItem.products) ? plaidItem.products : [];
  const hasInvestmentsProduct = products.includes('investments');
  const hasTransactionsProduct = products.includes('transactions');
  const shouldRunTransactionsSync = hasTransactionsProduct || !hasInvestmentsProduct;

  const responsePayload: ResponsePayload = {
    success: true,
    item_id: plaidItem.item_id,
    products,
    transaction_sync: null,
    holdings_sync: null,
    investment_transactions_sync: null,
  };

  // Forward the verified userId via header so internal route handlers
  // pick it up through requireVerifiedUserId().
  const internalHeaders = new Headers({ 'x-user-id': userId });

  if (shouldRunTransactionsSync) {
    const { POST: syncEndpoint } = await import('../transactions/sync/route');
    const syncRequest = {
      headers: internalHeaders,
      json: async () => ({
        plaidItemId: plaidItem.id,
        forceSync: true,
      }),
    } as unknown as NextRequest;
    const syncResponse = await syncEndpoint(syncRequest, { params: Promise.resolve({}) });
    const syncResult = (await syncResponse.json()) as Record<string, unknown>;
    responsePayload.transaction_sync = {
      success: syncResponse.ok,
      ...syncResult,
    };
    if (!syncResponse.ok) responsePayload.success = false;
  }

  if (hasInvestmentsProduct) {
    const { POST: holdingsSyncEndpoint } = await import('../investments/holdings/sync/route');
    const holdingsSyncRequest = {
      headers: internalHeaders,
      json: async () => ({
        plaidItemId: plaidItem.id,
        forceSync: true,
        includeDebug: includeHoldingsDebug,
      }),
    } as unknown as NextRequest;
    const holdingsSyncResponse = await holdingsSyncEndpoint(holdingsSyncRequest, {
      params: Promise.resolve({}),
    });
    const holdingsSyncResult = (await holdingsSyncResponse.json()) as Record<string, unknown>;
    responsePayload.holdings_sync = {
      success: holdingsSyncResponse.ok,
      ...holdingsSyncResult,
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
        ...(invTxSyncResult as unknown as Record<string, unknown>),
      };
    } catch (invTxError) {
      responsePayload.investment_transactions_sync = {
        success: false,
        error: invTxError instanceof Error ? invTxError.message : String(invTxError),
      };
      responsePayload.success = false;
    }
  }

  logger.info('Manual sync completed', {
    item_id: plaidItem.item_id,
    success: responsePayload.success,
    has_transactions_sync: !!responsePayload.transaction_sync,
    has_holdings_sync: !!responsePayload.holdings_sync,
    has_investment_transactions_sync: !!responsePayload.investment_transactions_sync,
  });
  await logger.flush();

  return Response.json(responsePayload);
});
