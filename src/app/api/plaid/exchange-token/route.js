import { waitUntil } from 'next/server';
import { exchangePublicToken, getAccounts, getInstitution } from '../../../../lib/plaid/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { createAccountSnapshots } from '../../../../lib/accountSnapshotUtils';
import { requireVerifiedUserId } from '../../../../lib/api/auth';
import { getPlaidProducts } from '../../../../lib/tierConfig';

export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const { publicToken, existingPlaidItemId } = await request.json();
    if (!publicToken) {
      return Response.json(
        { error: 'Public token is required' },
        { status: 400 }
      );
    }

    // Fetch user's subscription tier for tier-based filtering
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    const subscriptionTier = userProfile?.subscription_tier || 'free';
    const tierPlaidProducts = getPlaidProducts(subscriptionTier);
    const tierAllowsInvestments = tierPlaidProducts.includes('investments');

    // Exchange public token for access token
    const tokenResponse = await exchangePublicToken(publicToken);
    const { access_token, item_id } = tokenResponse;
    // Get accounts from Plaid
    const accountsResponse = await getAccounts(access_token);
    const { accounts: allAccounts, institution_id } = accountsResponse;
    console.log(`📊 Found ${allAccounts.length} total accounts for institution: ${institution_id || accountsResponse.item?.institution_id}`);

    // Filter out investment accounts if tier doesn't include investments product
    const accounts = tierAllowsInvestments
      ? allAccounts
      : allAccounts.filter(a => a.type !== 'investment');

    if (!tierAllowsInvestments && allAccounts.some(a => a.type === 'investment')) {
      console.log(`🔒 Filtered out ${allAccounts.filter(a => a.type === 'investment').length} investment account(s) — tier "${subscriptionTier}" does not include investments`);
    }

    if (accounts.length === 0) {
      console.warn('⚠️ No accounts available after tier filtering');
      return Response.json(
        { error: 'No accounts found', details: 'No eligible accounts found for your plan. Investment accounts require a Pro subscription.' },
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

    // Detect which products are needed based on the account types returned
    const hasInvestmentAccounts = accounts.some(a => a.type === 'investment');
    const hasTransactionAccounts = accounts.some(a => a.type === 'depository' || a.type === 'credit');

    // Build the products array reflecting what actually came back
    const products = [];
    if (hasTransactionAccounts) products.push('transactions');
    if (hasInvestmentAccounts) products.push('investments');
    if (products.length === 0) products.push('transactions'); // fallback

    console.log(`🏷️ Detected products from accounts: ${products.join(', ')}`);

    // Get institution info (with fallback)
    let institution = null;
    let institutionData = null;
    const actualInstitutionId = institution_id || accountsResponse.item?.institution_id;
    if (actualInstitutionId) {
      try {
        institution = await getInstitution(actualInstitutionId);
        // Resolve logo: prefer Plaid's logo, fall back to logo.dev from institution URL
        // Plaid returns logos as raw base64 — prefix with data URI so browsers can render them
        let resolvedLogo = institution.logo
          ? (institution.logo.startsWith('http') || institution.logo.startsWith('data:')
              ? institution.logo
              : `data:image/png;base64,${institution.logo}`)
          : null;
        if (!resolvedLogo && institution.url) {
          try {
            const domain = new URL(institution.url).hostname.replace(/^www\./, '');
            const logoDevKey = process.env.LOGO_DEV_PUBLIC_KEY;
            if (domain && logoDevKey) {
              resolvedLogo = `https://img.logo.dev/${domain}?token=${logoDevKey}`;
            }
          } catch (_) { /* invalid URL, skip */ }
        }
        // Upsert institution in database — never downgrade a populated logo to null
        let instData, institutionError;
        if (resolvedLogo !== null) {
          // We have a logo — safe to upsert normally
          ({ data: instData, error: institutionError } = await supabaseAdmin
            .from('institutions')
            .upsert({
              institution_id: institution.institution_id,
              name: institution.name,
              logo: resolvedLogo,
              primary_color: institution.primary_color,
              url: institution.url,
            }, {
              onConflict: 'institution_id'
            })
            .select()
            .single());
        } else {
          // No logo resolved — check if row already exists to avoid overwriting a good logo
          const { data: existingInst } = await supabaseAdmin
            .from('institutions')
            .select('*')
            .eq('institution_id', institution.institution_id)
            .maybeSingle();

          if (existingInst) {
            // Row exists — update name/color/url but keep the existing logo
            ({ data: instData, error: institutionError } = await supabaseAdmin
              .from('institutions')
              .update({
                name: institution.name,
                primary_color: institution.primary_color,
                url: institution.url,
              })
              .eq('institution_id', institution.institution_id)
              .select()
              .single());
          } else {
            // New row — insert with null logo (nothing to preserve)
            ({ data: instData, error: institutionError } = await supabaseAdmin
              .from('institutions')
              .insert({
                institution_id: institution.institution_id,
                name: institution.name,
                logo: null,
                primary_color: institution.primary_color,
                url: institution.url,
              })
              .select()
              .single());
          }
        }
        if (institutionError) {
          console.error('Error upserting institution:', institutionError);
        } else {
          institutionData = instData;
        }
      } catch (instError) {
        console.error('Error getting institution info, continuing without it:', instError);
      }
    }

    // Determine if this is an update-mode flow merging into an existing plaid_item
    let existingPlaidItem = null;
    if (existingPlaidItemId) {
      const { data: existingItem } = await supabaseAdmin
        .from('plaid_items')
        .select('*')
        .eq('id', existingPlaidItemId)
        .eq('user_id', userId)
        .maybeSingle();
      existingPlaidItem = existingItem || null;
      if (existingPlaidItem) {
        console.log(`🔄 Update mode: merging into existing plaid_item ${existingPlaidItemId} (item_id: ${existingPlaidItem.item_id})`);
      }
    }

    // First, create or update the plaid_item
    // In update mode, we update the existing item's products and access_token rather than creating a new one
    let plaidItemData, plaidItemError;
    if (existingPlaidItem) {
      // Update existing item — merge products and update access_token
      const mergedProducts = Array.from(new Set([...(existingPlaidItem.products || []), ...products]));
      ({ data: plaidItemData, error: plaidItemError } = await supabaseAdmin
        .from('plaid_items')
        .update({
          access_token: access_token,
          products: mergedProducts,
          sync_status: 'idle',
        })
        .eq('id', existingPlaidItem.id)
        .select()
        .single());
    } else {
      ({ data: plaidItemData, error: plaidItemError } = await supabaseAdmin
        .from('plaid_items')
        .upsert({
          user_id: userId,
          item_id: item_id,
          access_token: access_token,
          sync_status: 'idle',
          products: products,
          // recurring_ready: true for items that have transaction accounts
          recurring_ready: hasTransactionAccounts,
        }, {
          onConflict: 'user_id,item_id'
        })
        .select()
        .single());
    }
    if (plaidItemError) {
      console.error('Error upserting plaid item:', plaidItemError);
      return Response.json(
        { error: 'Failed to save plaid item', details: plaidItemError.message },
        { status: 500 }
      );
    }

    // In update mode, use the existing item's item_id so accounts are associated correctly
    const effectiveItemId = existingPlaidItem ? existingPlaidItem.item_id : item_id;

    // Process and save all accounts
    const accountsToInsert = [];
    const accountsToUpdate = [];

    for (const account of accounts) {
      const accountKey = `${effectiveItemId}_${account.account_id}`;
      const isInvestmentAccount = account.type === 'investment';

      if (isInvestmentAccount) {
        // Try to match existing investment account first
        let { data: existingAccount } = await supabaseAdmin
          .from('accounts')
          .select('*')
          .eq('item_id', effectiveItemId)
          .eq('account_id', account.account_id)
          .eq('user_id', userId)
          .maybeSingle();

        // Fallback: try matching by item_id + name + type
        if (!existingAccount) {
          const { data: matchedAccount } = await supabaseAdmin
            .from('accounts')
            .select('*')
            .eq('item_id', effectiveItemId)
            .eq('name', account.name)
            .eq('type', 'investment')
            .eq('user_id', userId)
            .maybeSingle();
          existingAccount = matchedAccount;
        }

        if (existingAccount) {
          accountsToUpdate.push({
            id: existingAccount.id,
            name: account.name,
            mask: account.mask,
            type: account.type,
            subtype: account.subtype,
            balances: account.balances,
            product_type: 'investments',
            access_token: access_token,
            institution_id: institutionData?.id || existingAccount.institution_id,
            plaid_item_id: plaidItemData.id,
          });
          console.log(`🔄 Matched existing investment account ${existingAccount.id}, will update in place`);
        } else {
          accountsToInsert.push({
            user_id: userId,
            item_id: effectiveItemId,
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
        // Depository / credit account
        accountsToInsert.push({
          user_id: userId,
          item_id: effectiveItemId,
          account_id: account.account_id,
          name: account.name,
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
          balances: account.balances,
          product_type: 'transactions',
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
      }
    } catch (snapshotError) {
      console.warn('Error creating account snapshots:', snapshotError);
    }

    // Use waitUntil to keep the serverless function alive until syncs complete
    waitUntil((async () => {
      // Trigger transaction sync for depository/credit accounts
      if (hasTransactionAccounts && accountsData.length > 0) {
        try {
          console.log('🔄 Starting transaction sync...');
          const { POST: syncEndpoint } = await import('../transactions/sync/route.js');
          const syncRequest = {
            headers: { get: () => null },
            json: async () => ({ plaidItemId: plaidItemData.id, userId }),
          };
          const syncResponse = await syncEndpoint(syncRequest);
          if (!syncResponse.ok) {
            const syncErrorBody = await syncResponse.json().catch(() => ({}));
            console.error('⚠️ Transaction sync failed:', JSON.stringify(syncErrorBody));
          } else {
            const syncResult = await syncResponse.json();
            console.log(`✅ Transaction sync completed: ${syncResult.transactions_synced} transactions synced`);
          }
        } catch (syncError) {
          console.warn('Error triggering transaction sync:', syncError);
        }
      }

      // Trigger holdings and investment transactions sync for investment accounts
      if (hasInvestmentAccounts && accountsData.length > 0) {
        // Sync holdings
        try {
          console.log('🔄 Starting holdings sync...');
          const { POST: holdingsSyncEndpoint } = await import('../investments/holdings/sync/route.js');
          const holdingsSyncRequest = {
            headers: { get: () => null },
            json: async () => ({ plaidItemId: plaidItemData.id, userId }),
          };
          const holdingsSyncResponse = await holdingsSyncEndpoint(holdingsSyncRequest);
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
          const { POST: invTxSyncEndpoint } = await import('../investments/transactions/sync/route.js');
          const invTxSyncRequest = {
            headers: { get: () => null },
            json: async () => ({ plaidItemId: plaidItemData.id, userId }),
          };
          const investmentTransactionsSyncResponse = await invTxSyncEndpoint(invTxSyncRequest);
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
    })());

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
