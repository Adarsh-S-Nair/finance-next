import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../lib/logger';

const logger = createLogger('sync-diagnostics');

export async function GET(request) {
  try {
    // Get all plaid items with their sync status
    const { data: plaidItems, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (itemsError) {
      throw new Error(`Failed to fetch plaid items: ${itemsError.message}`);
    }

    const diagnostics = {
      timestamp: new Date().toISOString(),
      totalItems: plaidItems.length,
      items: plaidItems.map(item => ({
        id: item.id,
        item_id: item.item_id,
        institution_id: item.institution_id,
        sync_status: item.sync_status,
        last_transaction_sync: item.last_transaction_sync,
        transaction_cursor: item.transaction_cursor ? 'SET' : 'NULL',
        last_error: item.last_error,
        created_at: item.created_at,
        daysSinceLastSync: item.last_transaction_sync
          ? Math.floor((Date.now() - new Date(item.last_transaction_sync).getTime()) / (1000 * 60 * 60 * 24))
          : null,
      })),
    };

    // Get transaction count per item
    for (const item of diagnostics.items) {
      const { count, error: countError } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .in('account_id',
          await supabaseAdmin
            .from('accounts')
            .select('id')
            .eq('plaid_item_id', item.id)
            .then(res => res.data?.map(a => a.id) || [])
        );

      if (!countError) {
        item.transactionCount = count;
      }

      // Get latest transaction date
      const accounts = await supabaseAdmin
        .from('accounts')
        .select('id')
        .eq('plaid_item_id', item.id);

      if (accounts.data && accounts.data.length > 0) {
        const accountIds = accounts.data.map(a => a.id);

        const { data: latestTx } = await supabaseAdmin
          .from('transactions')
          .select('datetime')
          .in('account_id', accountIds)
          .order('datetime', { ascending: false })
          .limit(1)
          .single();

        if (latestTx) {
          item.latestTransactionDate = latestTx.datetime;
          item.daysSinceLatestTransaction = Math.floor(
            (Date.now() - new Date(latestTx.datetime).getTime()) / (1000 * 60 * 60 * 24)
          );
        }
      }
    }

    // Summary analysis
    const issues = [];
    diagnostics.items.forEach(item => {
      if (item.sync_status === 'error') {
        issues.push(`Item ${item.item_id}: Sync status is ERROR - ${item.last_error}`);
      }
      if (item.daysSinceLastSync > 1) {
        issues.push(`Item ${item.item_id}: Last sync was ${item.daysSinceLastSync} days ago`);
      }
      if (item.daysSinceLatestTransaction > 2) {
        issues.push(`Item ${item.item_id}: Latest transaction is ${item.daysSinceLatestTransaction} days old`);
      }
      if (!item.transaction_cursor) {
        issues.push(`Item ${item.item_id}: No cursor set (never synced)`);
      }
    });

    diagnostics.issues = issues;
    diagnostics.hasIssues = issues.length > 0;

    logger.info('Sync diagnostics retrieved', {
      totalItems: diagnostics.totalItems,
      issuesFound: issues.length,
    });
    await logger.flush();

    return Response.json(diagnostics, { status: 200 });

  } catch (error) {
    logger.error('Error retrieving sync diagnostics', error);
    await logger.flush();

    return Response.json(
      { error: 'Failed to retrieve diagnostics', details: error.message },
      { status: 500 }
    );
  }
}
