import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../../lib/logger';

const logger = createLogger('investment-hard-reset-sync');

export async function POST(request) {
  let plaidItemId = null;

  try {
    const { plaidItemId: requestPlaidItemId, userId, includeHoldingsDebug = false } = await request.json();
    plaidItemId = requestPlaidItemId;

    if (!plaidItemId || !userId) {
      return Response.json(
        { error: 'Plaid item ID and user ID are required' },
        { status: 400 }
      );
    }

    logger.info('Hard reset sync requested', {
      plaidItemId,
      userId,
      includeHoldingsDebug
    });

    const { data: plaidItem, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .select('id, user_id, item_id, products')
      .eq('id', plaidItemId)
      .eq('user_id', userId)
      .single();

    if (itemError || !plaidItem) {
      return Response.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    const { data: investmentAccounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, account_id, name')
      .eq('plaid_item_id', plaidItemId)
      .eq('user_id', userId)
      .eq('type', 'investment');

    if (accountsError) {
      throw new Error(`Failed to load investment accounts: ${accountsError.message}`);
    }

    const accountIds = (investmentAccounts || []).map(a => a.id);
    let deletedInvestmentTransactions = 0;
    let deletedAccountSnapshots = 0;
    let deletedPortfolios = 0;

    if (accountIds.length > 0) {
      const { count: snapshotCountBeforeDelete } = await supabaseAdmin
        .from('account_snapshots')
        .select('id', { count: 'exact', head: true })
        .in('account_id', accountIds);

      const { error: deleteSnapshotsError } = await supabaseAdmin
        .from('account_snapshots')
        .delete()
        .in('account_id', accountIds);

      if (deleteSnapshotsError) {
        throw new Error(`Failed to delete account snapshots: ${deleteSnapshotsError.message}`);
      }
      deletedAccountSnapshots = snapshotCountBeforeDelete || 0;

      const { count: txCountBeforeDelete } = await supabaseAdmin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .in('account_id', accountIds)
        .eq('transaction_source', 'investments');

      const { error: deleteTxError } = await supabaseAdmin
        .from('transactions')
        .delete()
        .in('account_id', accountIds)
        .eq('transaction_source', 'investments');

      if (deleteTxError) {
        throw new Error(`Failed to delete investment transactions: ${deleteTxError.message}`);
      }
      deletedInvestmentTransactions = txCountBeforeDelete || 0;

      const { data: portfoliosToDelete, error: portfoliosError } = await supabaseAdmin
        .from('portfolios')
        .select('id')
        .in('source_account_id', accountIds)
        .eq('type', 'plaid_investment');

      if (portfoliosError) {
        throw new Error(`Failed to query portfolios for reset: ${portfoliosError.message}`);
      }

      const portfolioIds = (portfoliosToDelete || []).map(p => p.id);
      if (portfolioIds.length > 0) {
        const { error: deletePortfoliosError } = await supabaseAdmin
          .from('portfolios')
          .delete()
          .in('id', portfolioIds);

        if (deletePortfoliosError) {
          throw new Error(`Failed to delete portfolios: ${deletePortfoliosError.message}`);
        }
        deletedPortfolios = portfolioIds.length;
      }
    }

    const { POST: holdingsSyncEndpoint } = await import('../holdings/sync/route.js');
    const holdingsSyncRequest = {
      json: async () => ({
        plaidItemId,
        userId,
        forceSync: true,
        includeDebug: includeHoldingsDebug
      })
    };
    const holdingsSyncResponse = await holdingsSyncEndpoint(holdingsSyncRequest);
    const holdingsSyncResult = await holdingsSyncResponse.json();
    if (!holdingsSyncResponse.ok) {
      return Response.json(
        {
          error: 'Holdings sync failed after reset',
          details: holdingsSyncResult?.details || holdingsSyncResult?.error || 'Unknown error',
          holdings_sync: holdingsSyncResult
        },
        { status: 500 }
      );
    }

    const { POST: invTxSyncEndpoint } = await import('../transactions/sync/route.js');
    const invTxSyncRequest = {
      json: async () => ({
        plaidItemId,
        userId,
        forceSync: true
      })
    };
    const invTxSyncResponse = await invTxSyncEndpoint(invTxSyncRequest);
    const invTxSyncResult = await invTxSyncResponse.json();
    if (!invTxSyncResponse.ok) {
      return Response.json(
        {
          error: 'Investment transactions sync failed after reset',
          details: invTxSyncResult?.details || invTxSyncResult?.error || 'Unknown error',
          holdings_sync: holdingsSyncResult,
          investment_transactions_sync: invTxSyncResult
        },
        { status: 500 }
      );
    }

    logger.info('Hard reset sync completed', {
      plaidItemId,
      deleted_account_snapshots: deletedAccountSnapshots,
      deleted_investment_transactions: deletedInvestmentTransactions,
      deleted_portfolios: deletedPortfolios,
      holdings_synced: holdingsSyncResult?.holdings_synced || 0,
      investment_transactions_synced: invTxSyncResult?.transactions_synced || 0
    });
    await logger.flush();

    return Response.json({
      success: true,
      plaid_item_id: plaidItemId,
      deleted_account_snapshots: deletedAccountSnapshots,
      deleted_investment_transactions: deletedInvestmentTransactions,
      deleted_portfolios: deletedPortfolios,
      holdings_sync: holdingsSyncResult,
      investment_transactions_sync: invTxSyncResult
    });
  } catch (error) {
    logger.error('Hard reset sync failed', error, {
      plaidItemId,
      errorMessage: error.message
    });
    await logger.flush();
    return Response.json(
      { error: 'Failed to hard reset investment sync', details: error.message },
      { status: 500 }
    );
  }
}
