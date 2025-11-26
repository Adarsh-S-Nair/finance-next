import { getPlaidClient, PLAID_ENV, getTransactions, syncTransactions } from '../../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../../lib/supabaseAdmin';
import { formatCategoryName, generateUniqueCategoryColor } from '../../../../../lib/categoryUtils';
import { createAccountSnapshotConditional } from '../../../../../lib/accountSnapshotUtils';
import { createLogger } from '../../../../../lib/logger';

const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';
const logger = createLogger('transaction-sync');

export async function POST(request) {
  let plaidItemId = null; // Declare at function scope for error handling

  try {
    const { plaidItemId: requestPlaidItemId, userId, forceSync = false } = await request.json();
    plaidItemId = requestPlaidItemId; // Assign to function scope variable

    logger.info('Transaction sync request received', {
      plaidItemId,
      userId,
      forceSync
    });
    if (DEBUG) console.log(`🔄 Transaction sync request for plaid item: ${plaidItemId} (user: ${userId})`);

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

    logger.info('Plaid item found', {
      item_id: plaidItem.item_id,
      cursor: plaidItem.transaction_cursor || 'null'
    });

    if (DEBUG) console.log(`📋 Found plaid item: ${plaidItem.item_id} (cursor: ${plaidItem.transaction_cursor || 'null'})`);

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
    await supabaseAdmin
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
    if (DEBUG) console.log(`🌍 Plaid Environment: ${PLAID_ENV}`);
    if (PLAID_ENV === 'sandbox') {
      if (DEBUG) console.log('🏖️ Sandbox mode: Using transactions/get endpoint');

      // For sandbox, get transactions from the last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 30);

      if (DEBUG) console.log('🔍 Date calculation:', {
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

      if (DEBUG) {
        console.log(`📥 Fetching transactions from ${request.start_date} to ${request.end_date}`);
        console.log('🔍 Request details:', {
          start_date: request.start_date,
          end_date: request.end_date,
          count: request.count
        });
      }

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

      if (DEBUG) console.log(`📊 Received ${allTransactions.length} transactions from sandbox`);
    } else {
      // Production mode: Use transactions/sync endpoint with cursor-based pagination
      if (DEBUG) console.log('🚀 Production mode: Using transactions/sync endpoint');

      // Initialize cursor from stored value
      transactionCursor = plaidItem.transaction_cursor;
      let hasMore = true;
      let totalTransactions = 0;

      // Handle pagination if has_more is true
      while (hasMore) {
        try {
          if (DEBUG) console.log(`📥 Syncing transactions with cursor: ${transactionCursor || 'null'}`);

          const responseData = await syncTransactions(plaidItem.access_token, transactionCursor);

          // Avoid logging entire Plaid response; can be very large

          const {
            added,
            modified,
            removed,
            next_cursor,
            has_more,
            transactions_update_status,
            accounts
          } = responseData;

          // Combine added and modified transactions (modified are already processed)
          const batchTransactions = [...(added || []), ...(modified || [])];

          if (DEBUG) {
            console.log(`📊 Received ${batchTransactions.length} transactions in this batch (${added?.length || 0} added, ${modified?.length || 0} modified, ${removed?.length || 0} removed)`);
            console.log(`📈 Transaction update status: ${transactions_update_status}`);
            console.log(`🔄 Has more: ${has_more}, Next cursor: ${next_cursor || 'null'}`);
          }

          if (batchTransactions.length > 0) {
            allTransactions.push(...batchTransactions);
            totalTransactions += batchTransactions.length;
          }

          // Update cursor for next iteration
          transactionCursor = next_cursor;
          hasMore = has_more || false;

          // Safety check to prevent infinite loops
          if (totalTransactions > 10000) {
            console.warn('⚠️ Reached maximum transaction limit (10000), stopping pagination');
            break;
          }

        } catch (error) {
          console.error('❌ Plaid transactionsSync error:', error.response?.data || error.message);
          throw new Error(`Plaid API error: ${error.response?.data?.error_message || error.message}`);
        }
      }

      if (DEBUG) console.log(`📊 Total transactions received: ${allTransactions.length}`);

      if (allTransactions.length > 0) {
        // Log first few transactions for debugging
        if (DEBUG) console.log('🔍 Sample transactions:', allTransactions.slice(0, 3).map(t => ({
          id: t.transaction_id,
          description: t.name || t.original_description,
          amount: t.amount,
          account_id: t.account_id,
          pending: t.pending,
          datetime: t.datetime,
          date: t.date,
          authorized_date: t.authorized_date
        })));
      }
    }

    // Handle accounts data from Plaid response (for balance updates)
    let accountsToUpdate = [];
    let updatedAccountsCount = 0;
    let snapshotsCreatedCount = 0;
    if (PLAID_ENV !== 'sandbox') {
      // In production mode, we get accounts data from the sync response
      // We need to collect accounts from all pagination batches
      // For now, we'll get fresh account data from Plaid at the end of sync
      if (DEBUG) console.log('🏦 Fetching fresh account data from Plaid for balance updates...');
      try {
        const { getAccounts } = await import('../../../../../lib/plaidClient');
        const accountsResponse = await getAccounts(plaidItem.access_token);
        accountsToUpdate = accountsResponse.accounts || [];
        if (DEBUG) console.log(`📊 Retrieved ${accountsToUpdate.length} accounts for balance updates`);
      } catch (error) {
        console.error('❌ Failed to fetch accounts for balance updates:', error);
        // Don't fail the whole sync if account balance update fails
      }
    }

    // Get all accounts for this plaid item
    const { data: accounts, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .select('id, account_id')
      .eq('plaid_item_id', plaidItemId);

    if (accountsError) {
      throw new Error('Failed to fetch accounts');
    }

    if (DEBUG) console.log(`🏦 Found ${accounts.length} accounts for this plaid item`);

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

      // Prepare transaction data for upsert (category_id will be set later)
      const transactionData = {
        account_id: accountUuid,
        plaid_transaction_id: transaction.transaction_id,
        description: transaction.name || transaction.original_description || 'Unknown',
        amount: -parseFloat(transaction.amount),
        currency_code: transaction.iso_currency_code || 'USD',
        pending: transaction.pending,
        merchant_name: transaction.merchant_name,
        icon_url: transaction.logo_url || (transaction.counterparties && transaction.counterparties.length > 0 ? transaction.counterparties[0].logo_url : null),
        personal_finance_category: transaction.personal_finance_category,
        datetime: transaction.date ? new Date(transaction.date).toISOString() : null,
        location: transaction.location,
        payment_channel: transaction.payment_channel,
        website: transaction.website,
        pending_plaid_transaction_id: transaction.pending_transaction_id,
        category_id: null, // Will be set after system categories are created
        original_transaction: transaction // Keep reference for category linking
      };

      transactionsToUpsert.push(transactionData);
    }

    // Handle pending transaction updates (remove old pending, insert new posted)
    for (const pendingUpdate of pendingTransactionsToUpdate) {
      // Delete the pending transaction
      await supabaseAdmin
        .from('transactions')
        .delete()
        .eq('pending_plaid_transaction_id', pendingUpdate.pending_plaid_transaction_id)
        .eq('account_id', pendingUpdate.account_uuid);
    }

    // Create category groups from transaction categories
    if (transactionsToUpsert.length > 0) {
      if (DEBUG) console.log('🏷️ Processing category groups from transactions...');

      // Extract unique primary categories from transactions
      const primaryCategories = new Set();
      transactionsToUpsert.forEach(transaction => {
        if (transaction.personal_finance_category?.primary) {
          primaryCategories.add(transaction.personal_finance_category.primary);
        }
      });

      if (primaryCategories.size > 0) {
        if (DEBUG) console.log(`📋 Found ${primaryCategories.size} unique primary categories`);

        // Get existing category groups
        const { data: existingCategoryGroups, error: existingError } = await supabaseAdmin
          .from('category_groups')
          .select('name, hex_color');

        if (existingError) {
          console.error('❌ Failed to fetch existing category groups:', existingError);
          throw new Error(`Failed to fetch existing category groups: ${existingError.message}`);
        }

        const existingNames = new Set(existingCategoryGroups?.map(cg => cg.name) || []);
        const existingColors = existingCategoryGroups?.map(cg => cg.hex_color) || [];

        // Create new category groups for categories that don't exist
        const newCategoryGroups = [];
        for (const primaryCategory of primaryCategories) {
          const formattedName = formatCategoryName(primaryCategory);

          if (!existingNames.has(formattedName)) {
            const uniqueColor = generateUniqueCategoryColor(existingColors);
            newCategoryGroups.push({
              name: formattedName,
              hex_color: uniqueColor
            });
            existingColors.push(uniqueColor); // Add to existing colors for next iteration
            if (DEBUG) console.log(`🆕 Creating new category group: "${formattedName}"`);
          } else {
            if (DEBUG) console.log(`✅ Category group already exists: "${formattedName}"`);
          }
        }

        // Insert new category groups
        if (newCategoryGroups.length > 0) {
          const { error: categoryGroupsError } = await supabaseAdmin
            .from('category_groups')
            .insert(newCategoryGroups);

          if (categoryGroupsError) {
            console.error('❌ Failed to insert category groups:', categoryGroupsError);
            throw new Error(`Failed to insert category groups: ${categoryGroupsError.message}`);
          }

          if (DEBUG) console.log(`✅ Successfully created ${newCategoryGroups.length} new category groups`);
        }

        // Now process system_categories from detailed keys
        if (DEBUG) console.log('🏷️ Processing system categories from detailed keys...');

        // Extract unique detailed categories from transactions
        const detailedCategories = new Set();
        const categoryGroupMap = new Map(); // Map primary category to category group ID

        transactionsToUpsert.forEach(transaction => {
          if (transaction.personal_finance_category?.detailed && transaction.personal_finance_category?.primary) {
            const detailed = transaction.personal_finance_category.detailed;
            const primary = transaction.personal_finance_category.primary;

            // Remove the primary key from the beginning of detailed string
            if (detailed.startsWith(primary + '_')) {
              const cleanedDetailed = detailed.substring(primary.length + 1); // +1 for the underscore
              detailedCategories.add({
                detailed: cleanedDetailed,
                primary: primary
              });
            }
          }
        });

        if (detailedCategories.size > 0) {
          if (DEBUG) console.log(`📋 Found ${detailedCategories.size} unique detailed categories`);

          // Get all category groups (including newly created ones) to build the mapping
          const { data: allCategoryGroups, error: allGroupsError } = await supabaseAdmin
            .from('category_groups')
            .select('id, name');

          if (allGroupsError) {
            console.error('❌ Failed to fetch all category groups:', allGroupsError);
            throw new Error(`Failed to fetch all category groups: ${allGroupsError.message}`);
          }

          // Build mapping from primary category name to category group ID
          allCategoryGroups.forEach(group => {
            const primaryName = group.name.toUpperCase().replace(/\s+/g, '_');
            categoryGroupMap.set(primaryName, group.id);
          });

          // Get existing system categories
          const { data: existingSystemCategories, error: existingSystemError } = await supabaseAdmin
            .from('system_categories')
            .select('label');

          if (existingSystemError) {
            console.error('❌ Failed to fetch existing system categories:', existingSystemError);
            throw new Error(`Failed to fetch existing system categories: ${existingSystemError.message}`);
          }

          const existingSystemLabels = new Set(existingSystemCategories?.map(sc => sc.label) || []);

          // Create new system categories
          const newSystemCategories = [];
          for (const { detailed, primary } of detailedCategories) {
            const formattedLabel = formatCategoryName(detailed);
            const primaryName = primary.toUpperCase();
            const groupId = categoryGroupMap.get(primaryName);

            if (!existingSystemLabels.has(formattedLabel) && groupId) {
              newSystemCategories.push({
                label: formattedLabel,
                group_id: groupId
              });
              if (DEBUG) console.log(`🆕 Creating new system category: "${formattedLabel}" in group ID ${groupId}`);
            } else if (existingSystemLabels.has(formattedLabel)) {
              if (DEBUG) console.log(`✅ System category already exists: "${formattedLabel}"`);
            } else if (!groupId) {
              console.warn(`⚠️ No category group found for primary category: "${primary}"`);
            }
          }

          // Insert new system categories
          if (newSystemCategories.length > 0) {
            const { error: systemCategoriesError } = await supabaseAdmin
              .from('system_categories')
              .insert(newSystemCategories);

            if (systemCategoriesError) {
              console.error('❌ Failed to insert system categories:', systemCategoriesError);
              throw new Error(`Failed to insert system categories: ${systemCategoriesError.message}`);
            }

            if (DEBUG) console.log(`✅ Successfully created ${newSystemCategories.length} new system categories`);
          }
        }
      }
    }

    // Link transactions to their system categories
    if (transactionsToUpsert.length > 0) {
      if (DEBUG) console.log('🔗 Linking transactions to system categories...');

      // Get all system categories to build the mapping
      const { data: allSystemCategories, error: systemCategoriesError } = await supabaseAdmin
        .from('system_categories')
        .select('id, label');

      if (systemCategoriesError) {
        console.error('❌ Failed to fetch system categories for linking:', systemCategoriesError);
        throw new Error(`Failed to fetch system categories: ${systemCategoriesError.message}`);
      }

      // Build mapping from formatted label to system category ID
      const systemCategoryMap = new Map();
      allSystemCategories.forEach(category => {
        systemCategoryMap.set(category.label, category.id);
      });

      // Link each transaction to its system category
      let linkedCount = 0;
      for (const transactionData of transactionsToUpsert) {
        const pfc = transactionData.personal_finance_category;
        if (pfc?.detailed && pfc?.primary) {
          const detailed = pfc.detailed;
          const primary = pfc.primary;

          // Remove the primary key from the beginning of detailed string
          if (detailed.startsWith(primary + '_')) {
            const cleanedDetailed = detailed.substring(primary.length + 1);
            const formattedLabel = formatCategoryName(cleanedDetailed);
            const categoryId = systemCategoryMap.get(formattedLabel);

            if (categoryId) {
              transactionData.category_id = categoryId;
              linkedCount++;
            }
          }
        }

        // Remove the original_transaction reference before upsert
        delete transactionData.original_transaction;
      }

      if (DEBUG) console.log(`🔗 Linked ${linkedCount} transactions to system categories`);
    }

    // Upsert all transactions
    if (transactionsToUpsert.length > 0) {
      if (DEBUG) console.log(`💾 Upserting ${transactionsToUpsert.length} transactions to database...`);

      const { error: transactionsError } = await supabaseAdmin
        .from('transactions')
        .upsert(transactionsToUpsert, {
          onConflict: 'plaid_transaction_id'
        });

      if (transactionsError) {
        logger.error('Failed to upsert transactions', null, { error: transactionsError });
        throw new Error(`Failed to upsert transactions: ${transactionsError.message}`);
      }

      logger.info('Transactions upserted successfully', { count: transactionsToUpsert.length });
      if (DEBUG) console.log(`✅ Successfully upserted ${transactionsToUpsert.length} transactions`);
    } else {
      if (DEBUG) console.log('ℹ️ No transactions to upsert');
    }

    // Update account balances if we have fresh account data
    if (accountsToUpdate.length > 0) {
      if (DEBUG) console.log('💰 Updating account balances...');

      // Create mapping from Plaid account_id to our database account records
      const accountMap = {};
      accounts.forEach(account => {
        accountMap[account.account_id] = account.id;
      });

      // Update balances for each account
      for (const plaidAccount of accountsToUpdate) {
        const dbAccountId = accountMap[plaidAccount.account_id];
        if (dbAccountId && plaidAccount.balances) {
          try {
            // Update the account balance in the accounts table
            const { error: updateError } = await supabaseAdmin
              .from('accounts')
              .update({
                balances: plaidAccount.balances,
                updated_at: new Date().toISOString()
              })
              .eq('id', dbAccountId);

            if (updateError) {
              console.error(`❌ Failed to update balance for account ${plaidAccount.account_id}:`, updateError);
            } else {
              updatedAccountsCount++;
              if (DEBUG) console.log(`✅ Updated balance for account ${plaidAccount.account_id}`);

              // Create account snapshot if conditions are met
              try {
                const snapshotResult = await createAccountSnapshotConditional(plaidAccount, dbAccountId);
                if (snapshotResult.success && !snapshotResult.skipped) {
                  snapshotsCreatedCount++;
                  if (DEBUG) console.log(`📸 Created account snapshot for account ${plaidAccount.account_id}: ${snapshotResult.reason}`);
                } else if (snapshotResult.skipped) {
                  if (DEBUG) console.log(`⏭️ Skipped account snapshot for account ${plaidAccount.account_id}: ${snapshotResult.reason}`);
                } else {
                  console.warn(`⚠️ Failed to create account snapshot for account ${plaidAccount.account_id}: ${snapshotResult.error}`);
                }
              } catch (snapshotError) {
                console.warn(`⚠️ Error creating account snapshot for account ${plaidAccount.account_id}:`, snapshotError);
                // Don't fail the whole process if snapshot creation fails
              }
            }
          } catch (error) {
            console.error(`❌ Error updating balance for account ${plaidAccount.account_id}:`, error);
          }
        } else if (!dbAccountId) {
          console.warn(`⚠️ No database account found for Plaid account: ${plaidAccount.account_id}`);
        }
      }

      if (DEBUG) console.log(`💰 Updated balances for ${updatedAccountsCount} accounts`);
      if (snapshotsCreatedCount > 0) {
        if (DEBUG) console.log(`📸 Created ${snapshotsCreatedCount} account snapshots`);
      }
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

    const { error: updateError } = await supabaseAdmin
      .from('plaid_items')
      .update(updateData)
      .eq('id', plaidItemId);

    if (updateError) {
      throw new Error(`Failed to update plaid item: ${updateError.message}`);
    }

    logger.info('Transaction sync completed successfully', {
      transactions_synced: transactionsToUpsert.length,
      pending_transactions_updated: pendingTransactionsToUpdate.length,
      accounts_updated: accountsToUpdate.length > 0 ? updatedAccountsCount : 0,
      snapshots_created: accountsToUpdate.length > 0 ? snapshotsCreatedCount : 0
    });
    await logger.flush();

    return Response.json({
      success: true,
      transactions_synced: transactionsToUpsert.length,
      pending_transactions_updated: pendingTransactionsToUpdate.length,
      accounts_updated: accountsToUpdate.length > 0 ? updatedAccountsCount : 0,
      snapshots_created: accountsToUpdate.length > 0 ? snapshotsCreatedCount : 0,
      cursor: PLAID_ENV === 'sandbox' ? null : transactionCursor
    });

  } catch (error) {
    logger.error('Error syncing transactions', error, {
      plaidItemId,
      errorMessage: error.message,
      errorStack: error.stack
    });
    await logger.flush();

    // Update plaid item with error status
    if (plaidItemId) {
      await supabaseAdmin
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
