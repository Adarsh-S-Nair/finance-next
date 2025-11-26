import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../lib/logger';

const logger = createLogger('sync-all');

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return Response.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    logger.info('Sync all items requested', { userId });

    // Get all plaid items for this user
    const { data: plaidItems, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, item_id, user_id')
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

    logger.info('Starting sync for items', { userId, itemCount: plaidItems.length });

    // Import the sync endpoint
    const { POST: syncEndpoint } = await import('../transactions/sync/route.js');

    const syncResults = [];
    let successCount = 0;
    let failCount = 0;

    // Sync each item
    for (const item of plaidItems) {
      try {
        logger.info('Syncing item', { item_id: item.item_id });

        const syncRequest = {
          json: async () => ({
            plaidItemId: item.id,
            userId: item.user_id,
            forceSync: false
          })
        };

        const syncResponse = await syncEndpoint(syncRequest);
        const syncResult = await syncResponse.json();

        if (syncResponse.ok) {
          successCount++;
          syncResults.push({
            item_id: item.item_id,
            success: true,
            ...syncResult,
          });
          logger.info('Item synced successfully', { item_id: item.item_id });
        } else {
          failCount++;
          syncResults.push({
            item_id: item.item_id,
            success: false,
            error: syncResult.error || 'Unknown error',
          });
          logger.error('Item sync failed', null, { item_id: item.item_id, error: syncResult.error });
        }
      } catch (error) {
        failCount++;
        syncResults.push({
          item_id: item.item_id,
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
      success: true,
      itemsSynced: successCount,
      itemsFailed: failCount,
      totalItems: plaidItems.length,
      results: syncResults,
    });

  } catch (error) {
    logger.error('Error in sync-all', error);
    await logger.flush();

    return Response.json(
      { error: 'Failed to sync items', details: error.message },
      { status: 500 }
    );
  }
}
