import { getPlaidClient, PLAID_ENV, getTransactions } from '../../../../../lib/plaidClient';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  let plaidItemId = null; // Declare at function scope for error handling
  
  try {
    const { plaidItemId: requestPlaidItemId, userId, forceSync = false } = await request.json();
    plaidItemId = requestPlaidItemId; // Assign to function scope variable

    console.log(`🔄 Transaction sync request for plaid item: ${plaidItemId} (user: ${userId})`);

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
      console.error('Plaid item not found:', itemError);
      return Response.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    console.log(`📋 Found plaid item: ${plaidItem.item_id} (cursor: ${plaidItem.transaction_cursor || 'null'})`);

    // Check if already syncing (unless force sync is requested)
    if (plaidItem.sync_status === 'syncing' && !forceSync) {
      console.log('Item is already syncing, skipping');
      return Response.json({
        success: true,
        message: 'Item is already syncing',
        transactions_synced: 0,
        pending_transactions_updated: 0,
        cursor: plaidItem.transaction_cursor
      });
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
    let allTransactions = [];
    let transactionCursor = null; // Initialize for both modes

    // Use different approach based on environment
    if (PLAID_ENV === 'sandbox') {
      console.log('🏖️ Sandbox mode: Using transactions/get endpoint');
      
      // For sandbox, get transactions from the last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);
      
      console.log('🔍 Date calculation:', {
        endDate: endDate.toISOString(),
        startDate: startDate.toISOString(),
        endDateFormatted: endDate.toISOString().split('T')[0],
        startDateFormatted: startDate.toISOString().split('T')[0]
      });
      
      const request = {
        access_token: plaidItem.access_token,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        count: 500
      };

      console.log(`📥 Fetching transactions from ${request.start_date} to ${request.end_date}`);
      console.log('🔍 Request details:', { 
        start_date: request.start_date, 
        end_date: request.end_date,
        count: request.count 
      });
      
      let responseData;
      try {
        responseData = await getTransactions(
          plaidItem.access_token,
          request.start_date,
          request.end_date
        );
      } catch (error) {
        console.error('❌ Plaid transactionsGet error:', error.response?.data || error.message);
        throw new Error(`Plaid API error: ${error.response?.data?.error_message || error.message}`);
      }
      
      const { transactions } = responseData;
      allTransactions = transactions || [];

      console.log(`📊 Received ${allTransactions.length} transactions from sandbox`);
      
      if (allTransactions.length > 0) {
        // Log first few transactions for debugging
        console.log('🔍 Sample transactions:', allTransactions.slice(0, 3).map(t => ({
          id: t.transaction_id,
          description: t.name || t.original_description,
          amount: t.amount,
          account_id: t.account_id,
          pending: t.pending
        })));
      }
    } else {
      console.log('🏭 Production mode: Using transactions/sync endpoint');
      
      // Production mode: use cursor-based sync
      transactionCursor = plaidItem.transaction_cursor;
      let hasMore = true;
      let syncRequestCount = 0;
      const maxSyncRequests = 10; // Prevent infinite loops

      while (hasMore && syncRequestCount < maxSyncRequests) {
        const request = {
          access_token: plaidItem.access_token,
          cursor: transactionCursor,
          count: 500, // Maximum allowed by Plaid
        };

        console.log(`📥 Fetching transactions batch ${syncRequestCount + 1}, cursor: ${transactionCursor}`);
        
        const response = await client.transactionsSync(request);
        
        if (!response.data) {
          console.error('No data in Plaid response:', response);
          throw new Error('Invalid response from Plaid API');
        }
        
        const { transactions, next_cursor, has_more } = response.data;

        console.log(`📊 Received ${transactions?.length || 0} transactions in batch ${syncRequestCount + 1}`);
        
        if (transactions && transactions.length > 0) {
          // Log first few transactions for debugging
          console.log('🔍 Sample transactions:', transactions.slice(0, 3).map(t => ({
            id: t.transaction_id,
            description: t.name || t.original_description,
            amount: t.amount,
            account_id: t.account_id,
            pending: t.pending
          })));
          
          allTransactions.push(...transactions);
        }
        transactionCursor = next_cursor;
        hasMore = has_more;
        syncRequestCount++;

        // Break if we've fetched all transactions
        if (!has_more) {
          break;
        }
      }

      if (syncRequestCount >= maxSyncRequests) {
        console.warn(`⚠️ Reached maximum sync requests (${maxSyncRequests}), stopping sync`);
      }

      console.log(`📈 Total transactions fetched: ${allTransactions.length} in ${syncRequestCount} requests`);
    }

    // Get all accounts for this plaid item
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, account_id')
      .eq('plaid_item_id', plaidItemId);

    if (accountsError) {
      throw new Error('Failed to fetch accounts');
    }

    console.log(`🏦 Found ${accounts.length} accounts for this plaid item`);

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
      console.log(`💾 Upserting ${transactionsToUpsert.length} transactions to database...`);
      
      const { error: transactionsError } = await supabase
        .from('transactions')
        .upsert(transactionsToUpsert, {
          onConflict: 'plaid_transaction_id'
        });

      if (transactionsError) {
        console.error('❌ Failed to upsert transactions:', transactionsError);
        throw new Error(`Failed to upsert transactions: ${transactionsError.message}`);
      }
      
      console.log(`✅ Successfully upserted ${transactionsToUpsert.length} transactions`);
    } else {
      console.log('ℹ️ No transactions to upsert');
    }

    // Update plaid item with sync status
    const updateData = {
      last_transaction_sync: new Date().toISOString(),
      sync_status: 'idle',
      last_error: null
    };

    // Only update cursor in production mode (sandbox doesn't use cursors)
    if (PLAID_ENV !== 'sandbox') {
      updateData.transaction_cursor = transactionCursor;
    }

    const { error: updateError } = await supabase
      .from('plaid_items')
      .update(updateData)
      .eq('id', plaidItemId);

    if (updateError) {
      throw new Error(`Failed to update plaid item: ${updateError.message}`);
    }

    return Response.json({
      success: true,
      transactions_synced: transactionsToUpsert.length,
      pending_transactions_updated: pendingTransactionsToUpdate.length,
      cursor: PLAID_ENV === 'sandbox' ? null : transactionCursor
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
