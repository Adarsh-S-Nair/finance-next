import { getPlaidClient } from '../../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../../lib/logger';

const logger = createLogger('plaid-recurring-sync');

/**
 * POST /api/plaid/recurring/sync
 * Syncs recurring transaction streams from Plaid for all of a user's connected items.
 */
export async function POST(request) {
  try {
    const { userId, forceReset = false } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    logger.info('Starting recurring transactions sync', { userId, forceReset });

    // If forceReset, delete all existing recurring streams for this user
    if (forceReset) {
      logger.info('Force reset: deleting existing recurring streams', { userId });
      const { error: deleteError } = await supabaseAdmin
        .from('recurring_streams')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        logger.error('Error deleting existing streams', { error: deleteError.message });
      }
    }

    // Get all plaid items for this user that are ready for recurring transactions
    // Items are marked ready when they receive HISTORICAL_UPDATE or SYNC_UPDATES_AVAILABLE webhook
    const { data: allItems, error: allItemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, access_token, recurring_ready')
      .eq('user_id', userId);

    if (allItemsError) {
      throw new Error(`Failed to fetch plaid items: ${allItemsError.message}`);
    }

    if (!allItems || allItems.length === 0) {
      logger.info('No plaid items found for user', { userId });
      return Response.json({
        success: true,
        message: 'No connected accounts',
        synced: 0
      });
    }

    // Filter to only ready items
    const plaidItems = allItems.filter(item => item.recurring_ready === true);
    const notReadyCount = allItems.length - plaidItems.length;

    if (notReadyCount > 0) {
      logger.info('Some items not ready for recurring detection', {
        userId,
        readyCount: plaidItems.length,
        notReadyCount
      });
    }

    if (plaidItems.length === 0) {
      logger.info('No items ready for recurring detection yet', { userId });
      return Response.json({
        success: true,
        message: 'Accounts are still syncing transaction history. Please try again later.',
        synced: 0,
        itemsNotReady: notReadyCount
      });
    }

    const client = getPlaidClient();
    let totalSynced = 0;
    const errors = [];

    // Process each plaid item
    for (const item of plaidItems) {
      try {
        logger.info('Fetching recurring transactions for item', {
          plaidItemId: item.id
        });

        // Call Plaid's recurring transactions API
        const response = await client.transactionsRecurringGet({
          access_token: item.access_token,
        });

        const { inflow_streams, outflow_streams, updated_datetime } = response.data;

        logger.info('Received recurring streams from Plaid', {
          plaidItemId: item.id,
          inflowCount: inflow_streams?.length || 0,
          outflowCount: outflow_streams?.length || 0,
        });

        // Process inflow streams (income/deposits)
        const inflowRecords = (inflow_streams || []).map(stream =>
          transformStreamToRecord(stream, 'inflow', userId, item.id)
        );

        // Process outflow streams (expenses/bills)
        const outflowRecords = (outflow_streams || []).map(stream =>
          transformStreamToRecord(stream, 'outflow', userId, item.id)
        );

        const allRecords = [...inflowRecords, ...outflowRecords];

        if (allRecords.length > 0) {
          // Upsert all streams (keyed by stream_id)
          const { error: upsertError } = await supabaseAdmin
            .from('recurring_streams')
            .upsert(allRecords, {
              onConflict: 'stream_id',
              ignoreDuplicates: false
            });

          if (upsertError) {
            throw new Error(`Failed to upsert streams: ${upsertError.message}`);
          }

          totalSynced += allRecords.length;
        }

        // Mark any streams that are no longer returned by Plaid as inactive
        const activeStreamIds = allRecords.map(r => r.stream_id);
        if (activeStreamIds.length > 0) {
          await supabaseAdmin
            .from('recurring_streams')
            .update({ is_active: false })
            .eq('plaid_item_id', item.id)
            .not('stream_id', 'in', `(${activeStreamIds.join(',')})`);
        }

      } catch (itemError) {
        // Log the full error for debugging
        console.error('❌ Full error object:', itemError);
        console.error('❌ Error response:', itemError.response?.data);

        // Extract meaningful error message from Plaid API errors
        const errorMessage = itemError.response?.data?.error_message
          || itemError.response?.data?.error_code
          || itemError.message
          || String(itemError)
          || 'Unknown error';

        logger.error('Error syncing recurring for item', {
          plaidItemId: item.id,
          error: errorMessage,
          errorCode: itemError.response?.data?.error_code,
          errorType: itemError.response?.data?.error_type,
        });
        errors.push({
          plaidItemId: item.id,
          error: errorMessage,
          errorCode: itemError.response?.data?.error_code,
        });
      }
    }

    await logger.flush();

    // Separate consent errors from other errors
    const consentErrors = errors.filter(e => e.errorCode === 'ADDITIONAL_CONSENT_REQUIRED');
    const otherErrors = errors.filter(e => e.errorCode !== 'ADDITIONAL_CONSENT_REQUIRED');

    return Response.json({
      success: otherErrors.length === 0,
      synced: totalSynced,
      itemsProcessed: plaidItems.length,
      errors: otherErrors.length > 0 ? otherErrors : undefined,
      // Include items that need additional consent so frontend can prompt user
      itemsNeedingConsent: consentErrors.length > 0
        ? consentErrors.map(e => e.plaidItemId)
        : undefined,
    });

  } catch (error) {
    logger.error('Error in recurring sync', { error: error.message });
    await logger.flush();

    return Response.json(
      { error: 'Failed to sync recurring transactions', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Transform a Plaid stream object into our database record format
 */
function transformStreamToRecord(stream, streamType, userId, plaidItemId) {
  return {
    user_id: userId,
    plaid_item_id: plaidItemId,
    account_id: stream.account_id,
    stream_id: stream.stream_id,
    stream_type: streamType,
    description: stream.description,
    merchant_name: stream.merchant_name || null,
    frequency: stream.frequency,
    status: stream.status,
    is_active: stream.is_active,
    first_date: stream.first_date,
    last_date: stream.last_date,
    predicted_next_date: stream.predicted_next_date || null,
    average_amount: Math.abs(stream.average_amount?.amount || 0),
    last_amount: Math.abs(stream.last_amount?.amount || 0),
    iso_currency_code: stream.average_amount?.iso_currency_code || 'USD',
    category_primary: stream.personal_finance_category?.primary || null,
    category_detailed: stream.personal_finance_category?.detailed || null,
    transaction_ids: stream.transaction_ids || [],
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString(),
  };
}
