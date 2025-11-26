import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../lib/logger';

const logger = createLogger('manual-sync-trigger');

export async function POST(request) {
  try {
    const { plaidItemId } = await request.json();

    logger.info('Manual sync trigger requested', { plaidItemId });

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
    });

    // Call the sync endpoint
    const { POST: syncEndpoint } = await import('../transactions/sync/route.js');

    const syncRequest = {
      json: async () => ({
        plaidItemId: plaidItem.id,
        userId: plaidItem.user_id,
        forceSync: true // Force sync even if already syncing
      })
    };

    const syncResponse = await syncEndpoint(syncRequest);
    const syncResult = await syncResponse.json();

    logger.info('Manual sync completed', syncResult);
    await logger.flush();

    return Response.json({
      success: syncResponse.ok,
      ...syncResult,
    });

  } catch (error) {
    logger.error('Error triggering manual sync', error);
    await logger.flush();

    return Response.json(
      { error: 'Failed to trigger sync', details: error.message },
      { status: 500 }
    );
  }
}
