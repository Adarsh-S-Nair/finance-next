import { after } from 'next/server';
import { exchangePublicToken, getAccounts, getInstitution } from '../../../../lib/plaid/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { createAccountSnapshots } from '../../../../lib/accountSnapshotUtils';
import { withAuth } from '../../../../lib/api/withAuth';
import { getPlaidProducts } from '../../../../lib/tierConfig';
import { createLogger } from '../../../../lib/logger';
import { productsForAccounts } from '../../../../lib/plaid/productMap';
import { runSyncsForProducts } from '../../../../lib/plaid/syncRunners';
import { formatDisplayName } from '../../../../lib/utils/formatName';
import { encryptPlaidToken } from '../../../../lib/crypto/plaidTokens';
import type { TablesInsert, TablesUpdate } from '../../../../types/database';

const logger = createLogger('plaid-exchange-token');

interface RequestBody {
  publicToken?: string;
  existingPlaidItemId?: string | null;
}

interface PlaidAccount {
  account_id: string;
  name: string;
  type: string;
  subtype: string | null;
  mask: string | null;
  balances?: unknown;
}

interface PlaidInstitution {
  institution_id: string;
  name: string;
  logo?: string | null;
  primary_color?: string | null;
  url?: string | null;
}

export const POST = withAuth('plaid:exchange-token', async (request, userId) => {
  const { publicToken, existingPlaidItemId } = (await request.json()) as RequestBody;
  if (!publicToken) {
    return Response.json({ error: 'Public token is required' }, { status: 400 });
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

  // Exchange public token. `access_token` is the plaintext credential used
  // for outbound Plaid API calls in this request. `storedAccessToken` is
  // the AES-256-GCM-encrypted form we persist.
  const tokenResponse = (await exchangePublicToken(publicToken)) as unknown as {
    access_token: string;
    item_id: string;
  };
  const { access_token, item_id } = tokenResponse;
  const storedAccessToken = encryptPlaidToken(access_token);

  const accountsResponse = (await getAccounts(access_token)) as unknown as {
    accounts: PlaidAccount[];
    institution_id?: string | null;
    item?: { institution_id?: string | null };
  };
  const { accounts: allAccounts, institution_id } = accountsResponse;
  const resolvedInstitutionId = institution_id || accountsResponse.item?.institution_id;
  logger.info('Received accounts from Plaid', {
    totalAccounts: allAccounts.length,
    institutionId: resolvedInstitutionId,
  });

  const accounts = tierAllowsInvestments
    ? allAccounts
    : allAccounts.filter((a) => a.type !== 'investment');

  if (!tierAllowsInvestments && allAccounts.some((a) => a.type === 'investment')) {
    logger.info('Filtered out investment accounts by tier', {
      filtered: allAccounts.filter((a) => a.type === 'investment').length,
      tier: subscriptionTier,
    });
  }

  if (accounts.length === 0) {
    logger.warn('No accounts available after tier filtering', {
      totalAccounts: allAccounts.length,
      tier: subscriptionTier,
    });
    return Response.json(
      {
        error: 'No accounts found',
        details:
          'No eligible accounts found for your plan. Investment accounts require a Pro subscription.',
      },
      { status: 400 }
    );
  }

  // Derive the product list from the connected account types via the
  // central productMap. Adding a new Plaid product is a one-line edit
  // there — no need to touch this route.
  const products = productsForAccounts(accounts);
  if (products.length === 0) products.push('transactions');

  // These two flags drive a couple of legacy code paths below
  // (account upsert branching, recurring_ready). Keep them around but
  // derive them from the same shared source of truth.
  const hasInvestmentAccounts = accounts.some((a) => a.type === 'investment');
  const hasTransactionAccounts = accounts.some(
    (a) => a.type === 'depository' || a.type === 'credit'
  );

  logger.info('Detected products from accounts', { products });

  let institution: PlaidInstitution | null = null;
  let institutionData: { id: string } | null = null;
  const actualInstitutionId = institution_id || accountsResponse.item?.institution_id;
  if (actualInstitutionId) {
    try {
      institution = (await getInstitution(actualInstitutionId)) as unknown as PlaidInstitution;
      let resolvedLogo = institution.logo
        ? institution.logo.startsWith('http') || institution.logo.startsWith('data:')
          ? institution.logo
          : `data:image/png;base64,${institution.logo}`
        : null;
      if (!resolvedLogo && institution.url) {
        try {
          const domain = new URL(institution.url).hostname.replace(/^www\./, '');
          const logoDevKey = process.env.LOGO_DEV_PUBLIC_KEY;
          if (domain && logoDevKey) {
            resolvedLogo = `https://img.logo.dev/${domain}?token=${logoDevKey}`;
          }
        } catch {
          /* invalid URL, skip */
        }
      }

      let instData: { id: string } | null = null;
      let institutionError: { message: string } | null = null;
      if (resolvedLogo !== null) {
        ({ data: instData, error: institutionError } = await supabaseAdmin
          .from('institutions')
          .upsert(
            {
              institution_id: institution.institution_id,
              name: institution.name,
              logo: resolvedLogo,
              primary_color: institution.primary_color,
              url: institution.url,
            },
            { onConflict: 'institution_id' }
          )
          .select()
          .single());
      } else {
        const { data: existingInst } = await supabaseAdmin
          .from('institutions')
          .select('*')
          .eq('institution_id', institution.institution_id)
          .maybeSingle();

        if (existingInst) {
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
        logger.error('Failed to upsert institution', institutionError as Error, {
          institutionId: actualInstitutionId,
        });
      } else {
        institutionData = instData;
      }
    } catch (instError) {
      logger.error('Failed to fetch institution info, continuing without it', instError as Error, {
        institutionId: actualInstitutionId,
      });
    }
  }

  // Determine if this is an update-mode flow
  let existingPlaidItem: { id: string; item_id: string; products: string[] | null } | null = null;
  if (existingPlaidItemId) {
    const { data: existingItem } = await supabaseAdmin
      .from('plaid_items')
      .select('*')
      .eq('id', existingPlaidItemId)
      .eq('user_id', userId)
      .maybeSingle();
    existingPlaidItem = existingItem
      ? { id: existingItem.id, item_id: existingItem.item_id, products: existingItem.products }
      : null;
    if (existingPlaidItem) {
      logger.info('Update mode: merging into existing plaid_item', {
        plaidItemId: existingPlaidItemId,
        itemId: existingPlaidItem.item_id,
      });
    }
  }

  let plaidItemData: { id: string } | null = null;
  let plaidItemError: { message: string } | null = null;
  if (existingPlaidItem) {
    const mergedProducts = Array.from(
      new Set([...(existingPlaidItem.products || []), ...products])
    );
    ({ data: plaidItemData, error: plaidItemError } = await supabaseAdmin
      .from('plaid_items')
      .update({
        access_token: storedAccessToken,
        products: mergedProducts,
        sync_status: 'idle',
      })
      .eq('id', existingPlaidItem.id)
      .select()
      .single());
  } else {
    ({ data: plaidItemData, error: plaidItemError } = await supabaseAdmin
      .from('plaid_items')
      .upsert(
        {
          user_id: userId,
          item_id,
          access_token: storedAccessToken,
          sync_status: 'idle',
          products,
          recurring_ready: hasTransactionAccounts,
        },
        {
          onConflict: 'user_id,item_id',
        }
      )
      .select()
      .single());
  }
  if (plaidItemError || !plaidItemData) {
    logger.error('Failed to upsert plaid item', plaidItemError as Error, {
      itemId: item_id,
      existingPlaidItemId,
    });
    return Response.json({ error: 'Failed to save plaid item' }, { status: 500 });
  }

  const effectiveItemId = existingPlaidItem ? existingPlaidItem.item_id : item_id;

  const accountsToInsert: TablesInsert<'accounts'>[] = [];
  interface AccountUpdatePayload extends TablesUpdate<'accounts'> {
    id: string;
  }
  const accountsToUpdate: AccountUpdatePayload[] = [];

  for (const account of accounts) {
    const accountKey = `${effectiveItemId}_${account.account_id}`;
    const isInvestmentAccount = account.type === 'investment';

    if (isInvestmentAccount) {
      let { data: existingAccount } = await supabaseAdmin
        .from('accounts')
        .select('*')
        .eq('item_id', effectiveItemId)
        .eq('account_id', account.account_id)
        .eq('user_id', userId)
        .maybeSingle();

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
          name: formatDisplayName(account.name),
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
          product_type: 'investments',
          access_token: storedAccessToken,
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
          name: formatDisplayName(account.name),
          mask: account.mask,
          type: account.type,
          subtype: account.subtype,
          product_type: 'investments',
          access_token: storedAccessToken,
          account_key: accountKey,
          institution_id: institutionData?.id || null,
          plaid_item_id: plaidItemData.id,
        });
      }
    } else {
      accountsToInsert.push({
        user_id: userId,
        item_id: effectiveItemId,
        account_id: account.account_id,
        name: formatDisplayName(account.name),
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
        balances: account.balances as TablesInsert<'accounts'>['balances'],
        product_type: 'transactions',
        access_token: storedAccessToken,
        account_key: accountKey,
        institution_id: institutionData?.id || null,
        plaid_item_id: plaidItemData.id,
      });
    }
  }

  const updatedAccounts: Array<{ id: string; account_id: string; type: string | null }> = [];
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
        logger.error('Failed to update account', updateError as unknown as Error, {
          accountId: id,
        });
      } else if (updated) {
        updatedAccounts.push(updated);
      }
    }
  }

  let insertedAccounts: Array<{ id: string; account_id: string; type: string | null }> = [];
  if (accountsToInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('accounts')
      .upsert(accountsToInsert, {
        onConflict: 'plaid_item_id,account_id',
      })
      .select();
    if (insertError) {
      logger.error('Failed to upsert accounts', insertError as unknown as Error, {
        count: accountsToInsert.length,
      });
      return Response.json({ error: 'Failed to save accounts' }, { status: 500 });
    }
    insertedAccounts = inserted || [];
  }

  const accountsData = [...updatedAccounts, ...insertedAccounts];
  logger.info('Saved accounts', {
    total: accountsData.length,
    updated: updatedAccounts.length,
    inserted: insertedAccounts.length,
  });

  // Create account snapshots — skip investment accounts (holdings sync owns those).
  try {
    const plaidByAccountId = new Map(accounts.map((a) => [a.account_id, a]));
    const snapshotPairs = accountsData
      .filter((acc) => acc.type !== 'investment')
      .map((acc) => ({ plaid: plaidByAccountId.get(acc.account_id), id: acc.id }))
      .filter((p): p is { plaid: PlaidAccount; id: string } => Boolean(p.plaid));
    if (snapshotPairs.length > 0) {
      const snapshotResult = await createAccountSnapshots(
        snapshotPairs.map((p) => ({ balances: p.plaid.balances as Parameters<typeof createAccountSnapshots>[0][number]['balances'] })),
        snapshotPairs.map((p) => p.id)
      );
      if (snapshotResult.success) {
        logger.info('Created account snapshots', {
          count: snapshotResult.data.length,
        });
      } else {
        logger.warn('Failed to create account snapshots', {
          error: snapshotResult.error,
        });
      }
    }
  } catch (snapshotError) {
    logger.error('Exception while creating account snapshots', snapshotError as Error);
  }

  // Use after() to keep the serverless function alive until syncs complete.
  // Iterate over the products on this plaid_item and dispatch via the
  // sync runner registry — no per-product if-blocks here.
  after(async () => {
    if (accountsData.length > 0) {
      await runSyncsForProducts(products, {
        plaidItemId: plaidItemData.id,
        userId,
        logger,
      });
    }
    await logger.flush();
  });

  return Response.json({
    success: true,
    accounts: accountsData,
    institution: institutionData || null,
  });
});
