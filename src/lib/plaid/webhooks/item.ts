/**
 * ITEM webhook handler.
 *
 * Webhook codes handled:
 *   - ERROR → write the Plaid error onto plaid_items.sync_status / last_error.
 *   - NEW_ACCOUNTS_AVAILABLE → fetch fresh accounts from Plaid, honor the
 *     user's subscription tier (filter investment accounts for free tier),
 *     upsert the institution, and upsert the new accounts.
 *   - PENDING_EXPIRATION / USER_PERMISSION_REVOKED → log only for now.
 */

import { supabaseAdmin } from '../../supabase/admin';
import { getPlaidProducts } from '../../tierConfig';
import { getAccounts, getInstitution } from '../client';
import { loadPlaidItemByItemId } from './loadItem';
import { formatDisplayName } from '../../utils/formatName';
import type {
  ItemWebhookPayload,
  PlaidItemContext,
  WebhookLogger,
} from './types';

interface PlaidAccountLite {
  account_id: string;
  name?: string | null;
  mask?: string | null;
  type?: string | null;
  subtype?: string | null;
  balances?: Record<string, unknown> | null;
}

export async function handleItemWebhook(
  webhookData: ItemWebhookPayload,
  logger: WebhookLogger
): Promise<void> {
  const { webhook_code, item_id } = webhookData;
  const itemLogger = logger.child('item');

  itemLogger.info('Processing ITEM webhook', { webhook_code, item_id });

  const plaidItem = await loadPlaidItemByItemId(item_id, itemLogger);
  if (!plaidItem) return;

  switch (webhook_code) {
    case 'ERROR':
      await handleItemError(plaidItem, webhookData, itemLogger);
      break;
    case 'NEW_ACCOUNTS_AVAILABLE':
      await handleNewAccountsAvailable(plaidItem, itemLogger);
      break;
    case 'PENDING_EXPIRATION':
      itemLogger.warn('Item pending expiration', { item_id });
      break;
    case 'USER_PERMISSION_REVOKED':
      itemLogger.warn('User permission revoked', { item_id });
      break;
    default:
      itemLogger.warn('Unhandled item webhook code', { webhook_code });
  }
}

// ---------------------------------------------------------------------------
// ERROR
// ---------------------------------------------------------------------------

async function handleItemError(
  plaidItem: PlaidItemContext,
  webhookData: ItemWebhookPayload,
  itemLogger: WebhookLogger
): Promise<void> {
  itemLogger.error('Item error webhook received', null, {
    item_id: plaidItem.item_id,
    plaid_error: webhookData.error,
  });

  const { error: updateError } = await supabaseAdmin
    .from('plaid_items')
    .update({
      sync_status: 'error',
      last_error: webhookData.error?.error_message || 'Unknown error',
    })
    .eq('id', plaidItem.id);

  if (updateError) {
    itemLogger.error('Error updating plaid item status', null, { error: updateError });
  }
}

// ---------------------------------------------------------------------------
// NEW_ACCOUNTS_AVAILABLE
// ---------------------------------------------------------------------------

async function handleNewAccountsAvailable(
  plaidItem: PlaidItemContext,
  itemLogger: WebhookLogger
): Promise<void> {
  itemLogger.info('New accounts available', { item_id: plaidItem.item_id });

  try {
    // Look up user's tier to filter accounts appropriately.
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', plaidItem.user_id)
      .maybeSingle();

    const subscriptionTier =
      (userProfile as { subscription_tier?: string } | null)?.subscription_tier || 'free';
    const tierPlaidProducts = getPlaidProducts(subscriptionTier);
    const tierAllowsInvestments = tierPlaidProducts.includes('investments');

    const accountsResponse = (await getAccounts(plaidItem.access_token)) as {
      accounts?: PlaidAccountLite[];
      institution_id?: string | null;
      item?: { institution_id?: string | null };
    };
    const allAccounts = accountsResponse.accounts ?? [];

    const accounts = tierAllowsInvestments
      ? allAccounts
      : allAccounts.filter((a) => a.type !== 'investment');

    if (!tierAllowsInvestments && allAccounts.some((a) => a.type === 'investment')) {
      itemLogger.info('Filtered investment accounts due to tier restrictions', {
        item_id: plaidItem.item_id,
        filtered_count: allAccounts.filter((a) => a.type === 'investment').length,
        tier: subscriptionTier,
      });
    }

    itemLogger.info('Fetched accounts from Plaid', {
      item_id: plaidItem.item_id,
      total: allAccounts.length,
      eligible: accounts.length,
    });

    // Upsert institution (best-effort).
    let institutionData: { id: string } | null = null;
    const actualInstitutionId =
      accountsResponse.institution_id || accountsResponse.item?.institution_id || null;

    if (actualInstitutionId) {
      try {
        const institution = (await getInstitution(actualInstitutionId)) as {
          institution_id: string;
          name?: string | null;
          logo?: string | null;
          primary_color?: string | null;
          url?: string | null;
        };
        const { data: instData, error: institutionError } = await supabaseAdmin
          .from('institutions')
          .upsert(
            {
              institution_id: institution.institution_id,
              name: institution.name,
              logo: institution.logo,
              primary_color: institution.primary_color,
              url: institution.url,
            },
            { onConflict: 'institution_id' }
          )
          .select()
          .single();

        if (institutionError) {
          itemLogger.warn('Error upserting institution', { error: institutionError });
        } else {
          institutionData = instData as { id: string };
        }
      } catch (instError) {
        itemLogger.warn('Error getting institution info, continuing without it', {
          error: (instError as Error).message,
        });
      }
    }

    // Upsert fresh accounts. For investment accounts the holdings sync owns
    // `balances` (derived from live-priced holdings) — don't overwrite it
    // with Plaid's /accounts/get totals. We upsert investment and
    // non-investment accounts in two separate calls so each has a uniform
    // column shape.
    const buildRow = (account: PlaidAccountLite, includeBalances: boolean) => {
      const row: Record<string, unknown> = {
        user_id: plaidItem.user_id,
        item_id: plaidItem.item_id,
        account_id: account.account_id,
        name: formatDisplayName(account.name ?? ''),
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
        access_token: plaidItem.access_token,
        account_key: `${plaidItem.item_id}_${account.account_id}`,
        institution_id: institutionData?.id || null,
        plaid_item_id: plaidItem.id,
      };
      if (includeBalances) row.balances = account.balances;
      return row;
    };

    const investmentRows = accounts
      .filter((a) => a.type === 'investment')
      .map((a) => buildRow(a, false));
    const nonInvestmentRows = accounts
      .filter((a) => a.type !== 'investment')
      .map((a) => buildRow(a, true));

    let syncedCount = 0;
    for (const batch of [nonInvestmentRows, investmentRows]) {
      if (batch.length === 0) continue;
      const { data: accountsData, error: accountsError } = await supabaseAdmin
        .from('accounts')
        .upsert(batch, { onConflict: 'plaid_item_id,account_id' })
        .select();
      if (accountsError) {
        itemLogger.error('Error upserting new accounts', null, { error: accountsError });
      } else {
        syncedCount += (accountsData ?? []).length;
      }
    }

    itemLogger.info('Synced accounts', {
      item_id: plaidItem.item_id,
      count: syncedCount,
    });
  } catch (accountSyncError) {
    itemLogger.error('Error syncing new accounts', accountSyncError as Error, {
      item_id: plaidItem.item_id,
    });
  }
}
