import { exchangePublicToken, getAccounts, getInstitution } from '../../../../lib/plaid/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { createAccountSnapshots } from '../../../../lib/accountSnapshotUtils';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const { publicToken, accountType } = await request.json();
    if (!publicToken) {
      return Response.json(
        { error: 'Public token is required' },
        { status: 400 }
      );
    }
    // Determine product type based on accountType
    const isInvestmentProduct = accountType === 'investment';
    const isCreditCardProduct = accountType === 'credit_card';
    const isCheckingSavingsProduct = accountType === 'checking_savings';
    // Exchange public token for access token
    const tokenResponse = await exchangePublicToken(publicToken);
    const { access_token, item_id } = tokenResponse;
    // Get accounts from Plaid
    const accountsResponse = await getAccounts(access_token);
    const { accounts: allAccounts, institution_id } = accountsResponse;
    console.log(`📊 Found ${allAccounts.length} total accounts for institution: ${institution_id || accountsResponse.item?.institution_id}`);
    // Filter accounts based on the user's selected account type
    // This ensures we only store accounts that match the user's intent
    // (Plaid returns ALL accounts at an institution regardless of product requested)
    let accounts = allAccounts;
    if (accountType) {
      accounts = allAccounts.filter(account => {
        if (isInvestmentProduct) {
          // Only keep investment accounts when user selected brokerage/investment
          return account.type === 'investment';
        } else if (isCreditCardProduct) {
          // Only keep credit accounts when user selected credit card
          return account.type === 'credit';
        } else if (isCheckingSavingsProduct) {
          // Only keep depository accounts when user selected checking/savings
          return account.type === 'depository';
        }
        // Default: keep all accounts
        return true;
      });
      console.log(`🔍 Filtered to ${accounts.length} accounts matching type "${accountType}" (from ${allAccounts.length} total)`);
      // Log which accounts were filtered out for debugging
      const filteredOut = allAccounts.filter(a => !accounts.includes(a));
      if (filteredOut.length > 0) {
        console.log(`⏭️ Skipped ${filteredOut.length} accounts that don't match selected type:`,
          filteredOut.map(a => ({ name: a.name, type: a.type, subtype: a.subtype }))
        );
      }
    }
    // If no accounts match the filter, return an error
    if (accounts.length === 0) {
      console.warn(`⚠️ No accounts match the selected type "${accountType}"`);
      return Response.json(
        {
          error: 'No matching accounts found',
          details: `No ${accountType} accounts were found at this institution. The institution returned ${allAccounts.length} account(s) but none matched the selected account type.`
        },
        { status: 400 }
      );
    }
    // Debug logging for account details
    console.log('🔍 DEBUG: Full accounts response from exchange-token:', JSON.stringify(accountsResponse, null, 2));
    console.log('🔍 DEBUG: Individual accounts from exchange-token:', accounts.map(acc => ({
      account_id: acc.account_id,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      mask: acc.mask
    })));
    // Get institution info (with fallback)
    let institution = null;
    let institutionData = null;
    // Try to get institution_id from different possible locations
    const actualInstitutionId = institution_id || accountsResponse.item?.institution_id;
    if (actualInstitutionId) {
      try {
        institution = await getInstitution(actualInstitutionId);
        // Upsert institution in database
        const { data: instData, error: institutionError } = await supabaseAdmin
          .from('institutions')
          .upsert({
            institution_id: institution.institution_id,
            name: institution.name,
            logo: institution.logo,
            primary_color: institution.primary_color,
            url: institution.url,
          }, {
            onConflict: 'institution_id'
          })
          .select()
          .single();
        if (institutionError) {
          console.error('Error upserting institution:', institutionError);
          // Don't fail the whole process, just log the error
        } else {
          institutionData = instData;
        }
      } catch (instError) {
        console.error('Error getting institution info, continuing without it:', instError);
        // Continue without institution info - not critical for account creation
      }
    }
    // Determine products array based on account type
    const products = isInvestmentProduct ? ['investments'] : ['transactions'];
    // First, create or update the plaid_item
    const { data: plaidItemData, error: plaidItemError } = await supabaseAdmin
      .from('plaid_items')
      .upsert({
        user_id: userId,
        item_id: item_id,
        access_token: access_token,
        sync_status: 'idle',
        products: products,
        // Set recurring_ready only for transaction items (investments don't have recurring)
        recurring_ready: !isInvestmentProduct
      }, {
        onConflict: 'user_id,item_id'
      })
      .select()
      .single();
    if (plaidItemError) {
      console.error('Error upserting plaid item:', plaidItemError);
      return Response.json(
        { error: 'Failed to save plaid item', details: plaidItemError.message },
        { status: 500 }
      );
    }
    // Process and save accounts with smart matching for investment accounts
    const accountsToInsert = [];
    const accountsToUpdate = [];
    for (const account of accounts) {
      const accountKey = `${item_id}_${account.account_id}`;
      const isInvestmentAccount = account.type === 'investment';
      // For investment accounts, try to match existing account first
      if (isInvestmentAccount && isInvestmentProduct) {
        // Try to find existing account by item_id + account_id (best match)
        let { data: existingAccount } = await supabaseAdmin
          .from('accounts')
          .select('*')
          .eq('item_id', item_id)
          .eq('account_id', account.account_id)
          .eq('user_id', userId)
          .maybeSingle();
        // Fallback: try matching by item_id + name + type (for cases where account_id changed)
        if (!existingAccount) {
          const { data: matchedAccount } = await supabaseAdmin
            .from('accounts')
            .select('*')
            .eq('item_id', item_id)
            .eq('name', account.name)
            .eq('type', 'investment')
            .eq('user_id', userId)
            .maybeSingle();
          existingAccount = matchedAccount;
        }
        if (existingAccount) {
          // Update existing account in place (preserves account.id and snapshots)
          accountsToUpdate.push({
            id: existingAccount.id,
            ...{
              name: account.name,
              mask: account.mask,
              type: account.type,
              subtype: account.subtype,
              balances: account.balances,
              product_type: 'investments', // Upgrade to investments product
              access_token: access_token,
              institution_id: institutionData?.id || existingAccount.institution_id,
              plaid_item_id: plaidItemData.id,
            }
          });
          console.log(`🔄 Matched existing investment account ${existingAccount.id}, will update in place`);
        } else {
          // New investment account
          accountsToInsert.push({
            user_id: userId,
            item_id: item_id,
            account_id: account.account_id,
            name: account.name,
            mask: account.mask,
            type: account.type,
            subtype: account.subtype,
            balances: account.balances,
            product_type: 'investments',
            access_token: access_token,
            account_key: accountKey,
            institution_id: institutionData?.id || null,
            plaid_item_id: plaidItemData.id,
          });
        }
      } else {
        // Non-investment account or not from investments product
        accountsToInsert.push({
          user_id: userId,
          item_id: item_id,
          account_id: account.account_id,
          name: account.name,
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
          balances: account.balances,
          product_type: isInvestmentProduct && isInvestmentAccount ? 'investments' : 'transactions',
          access_token: access_token,
          account_key: accountKey,
          institution_id: institutionData?.id || null,
          plaid_item_id: plaidItemData.id,
        });
      }
    }
    // Update existing accounts
    let updatedAccounts = [];
    if (accountsToUpdate.length > 0) {
      for (const accountUpdate of accountsToUpdate) {
        const { id, ...updateData } = accountUpdate;
        const { data: updated, error: updateError } = await supabaseAdmin
          .from('accounts')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();
        if (updateError) {
          console.error('Error updating account:', updateError);
        } else {
          updatedAccounts.push(updated);
        }
      }
    }
    // Insert new accounts (upsert to handle duplicates)
    let insertedAccounts = [];
    if (accountsToInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('accounts')
        .upsert(accountsToInsert, {
          onConflict: 'plaid_item_id,account_id'
        })
        .select();
      if (insertError) {
        console.error('Error upserting accounts:', insertError);
        return Response.json(
          { error: 'Failed to save accounts', details: insertError.message },
          { status: 500 }
        );
      }
      insertedAccounts = inserted || [];
    }
    // Combine updated and inserted accounts
    const accountsData = [...updatedAccounts, ...insertedAccounts];
    console.log(`✅ Saved ${accountsData.length} accounts successfully`);
    console.log('🔍 DEBUG: Saved accounts:', accountsData.map(acc => ({
      id: acc.id,
      subtype: acc.subtype
    })));
    // Create account snapshots for the newly created accounts
    try {
      console.log('📸 Creating account snapshots...');
      const snapshotResult = await createAccountSnapshots(accounts, accountsData.map(acc => acc.id));
      if (snapshotResult.success) {
        console.log(`✅ Created ${snapshotResult.data.length} account snapshots successfully`);
      } else {
        console.warn('⚠️ Failed to create account snapshots:', snapshotResult.error);
        // Don't fail the whole process if snapshot creation fails
      }
    } catch (snapshotError) {
      console.warn('Error creating account snapshots:', snapshotError);
      // Don't fail the whole process if snapshot creation fails
    }
    // Trigger transaction sync for the new plaid item (only for checking/savings or credit card products)
    // We explicitly check the product type rather than just account types to avoid syncing transactions
    // for investment accounts that happen to also have a credit card
    const shouldSyncTransactions = !isInvestmentProduct && accountsData.length > 0;
    if (shouldSyncTransactions) {
      try {
        console.log('🔄 Starting transaction sync...');
        const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plaid/transactions/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            plaidItemId: plaidItemData.id,
          }),
        });
        if (!syncResponse.ok) {
          console.warn('⚠️ Transaction sync failed, but account linking succeeded');
        } else {
          const syncResult = await syncResponse.json();
          console.log(`✅ Transaction sync completed: ${syncResult.transactions_synced} transactions synced`);
        }
      } catch (syncError) {
        console.warn('Error triggering transaction sync:', syncError);
        // Don't fail the whole process if sync fails
      }
    }
    // Trigger holdings and investment transactions sync (only for investment product)
    const shouldSyncInvestments = isInvestmentProduct && accountsData.length > 0;
    if (shouldSyncInvestments) {
      // Sync holdings
      try {
        console.log('🔄 Starting holdings sync...');
        const holdingsSyncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plaid/investments/holdings/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            plaidItemId: plaidItemData.id,
          }),
        });
        if (!holdingsSyncResponse.ok) {
          console.warn('⚠️ Holdings sync failed, but account linking succeeded');
        } else {
          const holdingsSyncResult = await holdingsSyncResponse.json();
          console.log(`✅ Holdings sync completed: ${holdingsSyncResult.holdings_synced} holdings synced, ${holdingsSyncResult.portfolios_created} portfolios created`);
        }
      } catch (holdingsSyncError) {
        console.warn('Error triggering holdings sync:', holdingsSyncError);
      }
      // Sync investment transactions
      try {
        console.log('🔄 Starting investment transactions sync...');
        const investmentTransactionsSyncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plaid/investments/transactions/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            plaidItemId: plaidItemData.id,
          }),
        });
        if (!investmentTransactionsSyncResponse.ok) {
          console.warn('⚠️ Investment transactions sync failed, but account linking succeeded');
        } else {
          const investmentTransactionsSyncResult = await investmentTransactionsSyncResponse.json();
          console.log(`✅ Investment transactions sync completed: ${investmentTransactionsSyncResult.transactions_synced} transactions synced`);
        }
      } catch (investmentTransactionsSyncError) {
        console.warn('Error triggering investment transactions sync:', investmentTransactionsSyncError);
      }
    }
    return Response.json({
      success: true,
      accounts: accountsData,
      institution: institutionData || null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error exchanging token:', error);
    return Response.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
