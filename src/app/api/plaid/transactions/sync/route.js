import { getPlaidClient } from '../../../../../lib/plaidClient';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const { plaidItemId, userId } = await request.json();

    if (!plaidItemId || !userId) {
      return Response.json(
        { error: 'Plaid item ID and user ID are required' },
        { status: 400 }
      );
    }

    // Get the plaid item from database
    const { data: plaidItem, error: itemError } = await supabase
      .from('plaid_items')
      .select('*')
      .eq('id', plaidItemId)
      .eq('user_id', userId)
      .single();

    if (itemError || !plaidItem) {
      return Response.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    // Update sync status to 'syncing'
    await supabase
      .from('plaid_items')
      .update({ 
        sync_status: 'syncing',
        last_error: null 
      })
      .eq('id', plaidItemId);

    const client = getPlaidClient();
    let transactionCursor = plaidItem.transaction_cursor;
    let allTransactions = [];
    let hasMore = true;

    // Fetch transactions using cursor-based pagination
    while (hasMore) {
      const request = {
        access_token: plaidItem.access_token,
        cursor: transactionCursor,
        count: 500, // Maximum allowed by Plaid
      };

      const response = await client.transactionsSync(request);
      const { transactions, next_cursor, has_more } = response.data;

      allTransactions.push(...transactions);
      transactionCursor = next_cursor;
      hasMore = has_more;

      // Break if we've fetched all transactions
      if (!has_more) {
        break;
      }
    }

    // Get all accounts for this plaid item
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, account_id')
      .eq('plaid_item_id', plaidItemId);

    if (accountsError) {
      throw new Error('Failed to fetch accounts');
    }

    // Create account_id to uuid mapping
    const accountMap = {};
    accounts.forEach(account => {
      accountMap[account.account_id] = account.id;
    });

    // Process transactions for database insertion
    const transactionsToUpsert = [];
    const pendingTransactionsToUpdate = [];

    for (const transaction of allTransactions) {
      const accountUuid = accountMap[transaction.account_id];
      if (!accountUuid) {
        console.warn(`Account not found for transaction: ${transaction.account_id}`);
        continue;
      }

      // Check if this is a posted version of a pending transaction
      if (transaction.pending_transaction_id) {
        // Find the pending transaction and mark it for update
        pendingTransactionsToUpdate.push({
          pending_plaid_transaction_id: transaction.pending_transaction_id,
          new_transaction: transaction,
          account_uuid: accountUuid
        });
      }

      // Prepare transaction data for upsert
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: transaction.transaction_id,
        description: transaction.name || transaction.original_description || 'Unknown',
        amount: parseFloat(transaction.amount),
        currency_code: transaction.iso_currency_code || 'USD',
        pending: transaction.pending,
        merchant_name: transaction.merchant_name,
        icon_url: transaction.logo_url,
        personal_finance_category: transaction.personal_finance_category,
        datetime: transaction.datetime ? new Date(transaction.datetime).toISOString() : null,
        location: transaction.location,
        payment_channel: transaction.payment_channel,
        website: transaction.website,
        pending_plaid_transaction_id: transaction.pending_transaction_id,
      };

      transactionsToUpsert.push(transactionData);
    }

    // Handle pending transaction updates (remove old pending, insert new posted)
    for (const pendingUpdate of pendingTransactionsToUpdate) {
      // Delete the pending transaction
      await supabase
        .from('transactions')
        .delete()
        .eq('pending_plaid_transaction_id', pendingUpdate.pending_plaid_transaction_id)
        .eq('account_id', pendingUpdate.account_uuid);
    }

    // Upsert all transactions
    if (transactionsToUpsert.length > 0) {
      const { error: transactionsError } = await supabase
        .from('transactions')
        .upsert(transactionsToUpsert, {
          onConflict: 'plaid_transaction_id'
        });

      if (transactionsError) {
        throw new Error(`Failed to upsert transactions: ${transactionsError.message}`);
      }
    }

    // Update plaid item with new cursor and sync status
    const { error: updateError } = await supabase
      .from('plaid_items')
      .update({
        transaction_cursor: transactionCursor,
        last_transaction_sync: new Date().toISOString(),
        sync_status: 'idle',
        last_error: null
      })
      .eq('id', plaidItemId);

    if (updateError) {
      throw new Error(`Failed to update plaid item: ${updateError.message}`);
    }

    return Response.json({
      success: true,
      transactions_synced: transactionsToUpsert.length,
      pending_transactions_updated: pendingTransactionsToUpdate.length,
      cursor: transactionCursor
    });

  } catch (error) {
    console.error('Error syncing transactions:', error);

    // Update plaid item with error status
    if (plaidItemId) {
      await supabase
        .from('plaid_items')
        .update({
          sync_status: 'error',
          last_error: error.message
        })
        .eq('id', plaidItemId);
    }

    return Response.json(
      { error: 'Failed to sync transactions', details: error.message },
      { status: 500 }
    );
  }
}
