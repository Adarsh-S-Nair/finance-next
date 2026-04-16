import { after } from 'next/server';
import { exchangePublicToken, getAccounts, getInstitution } from '../../../../lib/plaid/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { createAccountSnapshots } from '../../../../lib/accountSnapshotUtils';
import { requireVerifiedUserId } from '../../../../lib/api/auth';
import { getPlaidProducts } from '../../../../lib/tierConfig';
import { createLogger } from '../../../../lib/logger';
import { syncInvestmentTransactionsForItem } from '../../../../lib/plaid/investmentTransactionSync';

const logger = createLogger('plaid-exchange-token');

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
    const resolvedInstitutionId = institution_id || accountsResponse.item?.institution_id;
    logger.info('Received accounts from Plaid', {
      totalAccounts: allAccounts.length,
      institutionId: resolvedInstitutionId,
    });

    // Filter out investment accounts if tier doesn't include investments product
    const accounts = tierAllowsInvestments
      ? allAccounts
      : allAccounts.filter(a => a.type !== 'investment');

    if (!tierAllowsInvestments && allAccounts.some(a => a.type === 'investment')) {
      logger.info('Filtered out investment accounts by tier', {
        filtered: allAccounts.filter(a => a.type === 'investment').length,
        tier: subscriptionTier,
      });
    }

    if (accounts.length === 0) {
      logger.warn('No accounts available after tier filtering', {
        totalAccounts: allAccounts.length,
        tier: subscriptionTier,
      });
      return Response.json(
        { error: 'No accounts found', details: 'No eligible accounts found for your plan. Investment accounts require a Pro subscription.' },
        { status: 400 }
      );
    }

    // Detect which products are needed based on the account types returned
    const hasInvestmentAccounts = accounts.some(a => a.type === 'investment');
    const hasTransactionAccounts = accounts.some(a => a.type === 'depository' || a.type === 'credit');

    // Build the products array reflecting what actually came back
    const products = [];
    if (hasTransactionAccounts) products.push('transactions');
    if (hasInvestmentAccounts) products.push('investments');
    if (products.length === 0) products.push('transactions'); // fallback

    logger.info('Detected products from accounts', { products });

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
          logger.error('Failed to upsert institution', institutionError, {
            institutionId: actualInstitutionId,
          });
        } else {
          institutionData = instData;
        }
      } catch (instError) {
        logger.error('Failed to fetch institution info, continuing without it', instError, {
          institutionId: actualInstitutionId,
        });
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
        logger.info('Update mode: merging into existing plaid_item', {
          plaidItemId: existingPlaidItemId,
          itemId: existingPlaidItem.item_id,
        });
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
      logger.error('Failed to upsert plaid item', plaidItemError, {
        itemId: item_id,
        existingPlaidItemId,
      });
      return Response.json(
        { error: 'Failed to save plaid item' },
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
          logger.debug('Matched existing investment account, will update in place', {
            accountId: existingAccount.id,
          });
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
          logger.error('Failed to update account', updateError, { accountId: id });
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
        logger.error('Failed to upsert accounts', insertError, {
          count: accountsToInsert.length,
        });
        return Response.json(
          { error: 'Failed to save accounts' },
          { status: 500 }
        );
      }
      insertedAccounts = inserted || [];
    }

    // Combine updated and inserted accounts
    const accountsData = [...updatedAccounts, ...insertedAccounts];
    logger.info('Saved accounts', {
      total: accountsData.length,
      updated: updatedAccounts.length,
      inserted: insertedAccounts.length,
    });

    // Create account snapshots for the newly created accounts
    try {
      const snapshotResult = await createAccountSnapshots(accounts, accountsData.map(acc => acc.id));
      if (snapshotResult.success) {
        logger.info('Created account snapshots', { count: snapshotResult.data.length });
      } else {
        logger.warn('Failed to create account snapshots', { error: snapshotResult.error });
      }
    } catch (snapshotError) {
      logger.error('Exception while creating account snapshots', snapshotError);
    }

    // Use after() to keep the serverless function alive until syncs complete
    after(async () => {
      // Forward the verified userId via header so internal route handlers
      // pick it up through requireVerifiedUserId().
      const internalHeaders = new Headers({ 'x-user-id': userId });

      // Trigger transaction sync for depository/credit accounts
      if (hasTransactionAccounts && accountsData.length > 0) {
        try {
          const { POST: syncEndpoint } = await import('../transactions/sync/route.js');
          const syncRequest = {
            headers: internalHeaders,
            json: async () => ({ plaidItemId: plaidItemData.id }),
          };
          const syncResponse = await syncEndpoint(syncRequest);
          if (!syncResponse.ok) {
            const syncErrorBody = await syncResponse.json().catch(() => ({}));
            logger.error('Transaction sync failed after exchange', null, {
              plaidItemId: plaidItemData.id,
              body: syncErrorBody,
            });
          } else {
            const syncResult = await syncResponse.json();
            logger.info('Transaction sync completed after exchange', {
              plaidItemId: plaidItemData.id,
              transactions_synced: syncResult.transactions_synced,
            });
          }
        } catch (syncError) {
          logger.error('Exception triggering transaction sync', syncError, {
            plaidItemId: plaidItemData.id,
          });
        }
      }

      // Trigger holdings and investment transactions sync for investment accounts
      if (hasInvestmentAccounts && accountsData.length > 0) {
        // Sync holdings
        try {
          const { POST: holdingsSyncEndpoint } = await import('../investments/holdings/sync/route.js');
          const holdingsSyncRequest = {
            headers: internalHeaders,
            json: async () => ({ plaidItemId: plaidItemData.id }),
          };
          const holdingsSyncResponse = await holdingsSyncEndpoint(holdingsSyncRequest);
          if (!holdingsSyncResponse.ok) {
            logger.warn('Holdings sync failed after exchange, but account linking succeeded', {
              plaidItemId: plaidItemData.id,
              status: holdingsSyncResponse.status,
            });
          } else {
            const holdingsSyncResult = await holdingsSyncResponse.json();
            logger.info('Holdings sync completed after exchange', {
              plaidItemId: plaidItemData.id,
              holdings_synced: holdingsSyncResult.holdings_synced,
            });
          }
        } catch (holdingsSyncError) {
          logger.error('Exception triggering holdings sync', holdingsSyncError, {
            plaidItemId: plaidItemData.id,
          });
        }

        // Sync investment transactions
        try {
          const invTxResult = await syncInvestmentTransactionsForItem({
            plaidItemId: plaidItemData.id,
            userId,
          });
          logger.info('Investment transactions sync completed after exchange', {
            plaidItemId: plaidItemData.id,
            transactions_synced: invTxResult.transactions_synced,
          });
        } catch (invTxError) {
          logger.error('Exception triggering investment transactions sync', invTxError, {
            plaidItemId: plaidItemData.id,
          });
        }
      }
      await logger.flush();
    });

    return Response.json({
      success: true,
      accounts: accountsData,
      institution: institutionData || null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    logger.error('Error exchanging token', error);
    await logger.flush();
    return Response.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
