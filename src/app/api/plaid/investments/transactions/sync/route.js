import { getPlaidClient, PLAID_ENV, getInvestmentTransactions } from '../../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../../lib/logger';

const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';
const logger = createLogger('investment-transactions-sync');

export async function POST(request) {
  let plaidItemId = null;

  try {
    const { plaidItemId: requestPlaidItemId, userId, forceSync = false } = await request.json();
    plaidItemId = requestPlaidItemId;

    logger.info('Investment transactions sync request received', {
      plaidItemId,
      userId,
      forceSync
    });
    if (DEBUG) console.log(`🔄 Investment transactions sync request for plaid item: ${plaidItemId} (user: ${userId})`);

    if (!plaidItemId || !userId) {
      logger.warn('Missing required parameters', { plaidItemId, userId });
      await logger.flush();
      return Response.json(
        { error: 'Plaid item ID and user ID are required' },
        { status: 400 }
      );
    }

    // Get the plaid item from database
    const { data: plaidItem, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .select('*')
      .eq('id', plaidItemId)
      .eq('user_id', userId)
      .single();

    if (itemError || !plaidItem) {
      logger.error('Plaid item not found', null, { plaidItemId, userId, error: itemError });
      await logger.flush();
      return Response.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    logger.info('Plaid item found', { item_id: plaidItem.item_id });
    if (DEBUG) console.log(`📋 Found plaid item: ${plaidItem.item_id}`);

    // Get all accounts for this plaid item (investment accounts only)
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, account_id, type')
      .eq('plaid_item_id', plaidItemId)
      .eq('type', 'investment');

    if (accountsError) {
      throw new Error('Failed to fetch investment accounts');
    }

    if (accounts.length === 0) {
      if (DEBUG) console.log('ℹ️ No investment accounts found for this plaid item');
      return Response.json({
        success: true,
        transactions_synced: 0,
        message: 'No investment accounts found'
      });
    }

    if (DEBUG) console.log(`🏦 Found ${accounts.length} investment accounts for this plaid item`);

    // Create account_id to uuid mapping
    const accountMap = {};
    accounts.forEach(account => {
      accountMap[account.account_id] = account.id;
    });

    // Fetch investment transactions from Plaid
    // Get transactions from the last 2 years (24 months as per Plaid docs)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(endDate.getFullYear() - 2);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    if (DEBUG) {
      console.log(`📥 Fetching investment transactions from ${startDateStr} to ${endDateStr}`);
    }

    let allTransactions = [];
    let securitiesMap = new Map();
    let offset = 0;
    const count = 500; // Max per Plaid docs
    let totalInvestmentTransactions = null;

    // Handle pagination
    while (true) {
      try {
        const responseData = await getInvestmentTransactions(
          plaidItem.access_token,
          startDateStr,
          endDateStr,
          accounts.map(acc => acc.account_id),
          { count, offset }
        );

        const { investment_transactions, total_investment_transactions, securities } = responseData;

        // Store total for pagination check
        if (totalInvestmentTransactions === null) {
          totalInvestmentTransactions = total_investment_transactions || 0;
        }

        // Build securities map (same for all pages)
        if (securities && securitiesMap.size === 0) {
          securities.forEach(sec => {
            securitiesMap.set(sec.security_id, {
              ticker: sec.ticker_symbol || sec.name,
              name: sec.name,
              type: sec.type,
              subtype: sec.subtype
            });
          });
        }

        if (investment_transactions && investment_transactions.length > 0) {
          allTransactions.push(...investment_transactions);
          if (DEBUG) {
            console.log(`📊 Received ${investment_transactions.length} investment transactions (total so far: ${allTransactions.length}/${totalInvestmentTransactions})`);
          }
        }

        // Check if we need to paginate
        if (totalInvestmentTransactions && allTransactions.length >= totalInvestmentTransactions) {
          // Fetched all transactions
          break;
        } else if (!investment_transactions || investment_transactions.length < count) {
          // Last page (less than count means we've reached the end)
          break;
        } else {
          // More pages to fetch
          offset += count;
        }

      } catch (error) {
        console.error('❌ Plaid investmentsTransactionsGet error:', error.response?.data || error.message);
        throw new Error(`Plaid API error: ${error.response?.data?.error_message || error.message}`);
      }
    }

    if (DEBUG) console.log(`📊 Total investment transactions received: ${allTransactions.length}`);

    // Process transactions for database insertion
    const transactionsToUpsert = [];

    for (const transaction of allTransactions) {
      const accountUuid = accountMap[transaction.account_id];
      if (!accountUuid) {
        console.warn(`Account not found for investment transaction: ${transaction.account_id}`);
        continue;
      }

      // Get security info if available
      const security = transaction.security_id ? securitiesMap.get(transaction.security_id) : null;

      // Prepare transaction data for upsert
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: transaction.investment_transaction_id,
        description: transaction.name || 'Investment Transaction',
        amount: parseFloat(transaction.amount), // Investment transactions: positive = cash debited (buy), negative = cash credited (sell)
        currency_code: transaction.iso_currency_code || 'USD',
        pending: false, // Investment transactions are not pending
        datetime: transaction.transaction_datetime ? new Date(transaction.transaction_datetime).toISOString() : null,
        date: transaction.date || null,
        transaction_source: 'investments',
        investment_details: {
          security_id: transaction.security_id || null,
          ticker: security?.ticker || null,
          security_name: security?.name || null,
          security_type: security?.type || null,
          security_subtype: security?.subtype || null,
          quantity: transaction.quantity ? parseFloat(transaction.quantity) : null,
          price: transaction.price ? parseFloat(transaction.price) : null,
          fees: transaction.fees ? parseFloat(transaction.fees) : null,
          type: transaction.type,
          subtype: transaction.subtype,
          cancel_transaction_id: transaction.cancel_transaction_id || null
        }
      };

      transactionsToUpsert.push(transactionData);
    }

    // Upsert all investment transactions
    if (transactionsToUpsert.length > 0) {
      if (DEBUG) console.log(`💾 Upserting ${transactionsToUpsert.length} investment transactions to database...`);

      const { error: transactionsError } = await supabaseAdmin
        .from('transactions')
        .upsert(transactionsToUpsert, {
          onConflict: 'plaid_transaction_id'
        });

      if (transactionsError) {
        logger.error('Failed to upsert investment transactions', null, { error: transactionsError });
        throw new Error(`Failed to upsert investment transactions: ${transactionsError.message}`);
      }

      logger.info('Investment transactions upserted successfully', { count: transactionsToUpsert.length });
      if (DEBUG) console.log(`✅ Successfully upserted ${transactionsToUpsert.length} investment transactions`);
    } else {
      if (DEBUG) console.log('ℹ️ No investment transactions to upsert');
    }

    logger.info('Investment transactions sync completed successfully', {
      transactions_synced: transactionsToUpsert.length
    });
    await logger.flush();

    return Response.json({
      success: true,
      transactions_synced: transactionsToUpsert.length
    });

  } catch (error) {
    logger.error('Error syncing investment transactions', error, {
      plaidItemId,
      errorMessage: error.message,
      errorStack: error.stack
    });
    await logger.flush();

    return Response.json(
      { error: 'Failed to sync investment transactions', details: error.message },
      { status: 500 }
    );
  }
}

