/**
 * Account disconnect orchestrator.
 *
 * Single entry point used by the `/api/plaid/disconnect-account` route.
 *
 * Critical logic (preserved byte-for-byte from the legacy route):
 *   1. Look up the account along with its parent plaid_item (for access_token).
 *   2. Delete the account FIRST. This cascades to transactions, account_snapshots,
 *      and holdings via ON DELETE CASCADE on the foreign keys.
 *   3. AFTER deleting, count remaining accounts for the plaid_item. This
 *      post-delete check is race-safe: whichever concurrent request deletes
 *      last sees count=0 and takes responsibility for the Plaid item cleanup.
 *   4. If this was the last account, call Plaid's /item/remove to stop being
 *      billed, then delete the plaid_items row. Swallow expected "dead item"
 *      error codes (`ITEM_NOT_FOUND`, `INVALID_ACCESS_TOKEN`, `ITEM_LOGIN_REQUIRED`)
 *      because they all mean the item is already unusable.
 *
 * Pattern: routes are thin (parse + dispatch + format response). Business
 * logic lives here. See `docs/architectural_patterns.md`.
 */

import { removeItem } from '../client';
import { supabaseAdmin } from '../../supabase/admin';
import { createLogger } from '../../logger';
import { decryptPlaidToken } from '../../crypto/plaidTokens';

import { extractPlaidErrorCode, isDeadItemError } from './errors';
import {
  DisconnectError,
  type DisconnectAccountParams,
  type DisconnectAccountResult,
} from './types';

const logger = createLogger('plaid-disconnect-account');

interface AccountWithPlaidItem {
  id: string;
  name: string | null;
  plaid_item_id: string;
  plaid_items: {
    id: string;
    item_id: string;
    access_token: string;
  } | null;
}

export async function disconnectAccount(
  params: DisconnectAccountParams
): Promise<DisconnectAccountResult> {
  const { accountId, userId } = params;

  logger.info('Disconnect account request received', { accountId, userId });

  const account = await loadAccountWithPlaidItem(accountId, userId);
  const plaidItemRowId = account.plaid_item_id;
  const plaidItem = account.plaid_items;

  logger.info('Found account to disconnect', {
    accountId,
    accountName: account.name,
    plaidItemRowId,
  });

  await deleteAccount(accountId, userId);
  logger.info('Account row deleted', { accountId });

  const remainingCount = await countRemainingAccountsForItem(plaidItemRowId, userId);
  if (remainingCount === null) {
    // We couldn't verify the remaining count — the account is already gone so
    // the user-visible operation succeeded. Log and bail out in the "not last
    // account" shape so we don't touch the Plaid item.
    logger.warn('Could not verify remaining account count after deletion', {
      plaidItemRowId,
    });
    return {
      success: true,
      message: 'Account disconnected successfully',
      wasLastAccount: false,
    };
  }

  logger.info('Remaining accounts for plaid_item', { plaidItemRowId, remainingCount });
  const isLastAccount = remainingCount === 0;

  if (!isLastAccount) {
    logger.info('Other accounts remain for plaid_item, skipping /item/remove', {
      plaidItemRowId,
    });
    return {
      success: true,
      message: 'Account disconnected successfully',
      wasLastAccount: false,
    };
  }

  // Last account for this Plaid item: remove upstream + delete the orphan row.
  // If Plaid removal fails with a non-dead-item code, we still return success
  // (the user-visible action worked) but with a warning so the UI can surface
  // it. This mirrors the legacy route's behavior.
  if (plaidItem?.access_token) {
    const warning = await removePlaidItemUpstream(plaidItem.access_token, plaidItemRowId);
    if (warning) {
      return {
        success: true,
        message: 'Account disconnected successfully',
        wasLastAccount: true,
        plaidRemovalWarning: warning,
      };
    }
  }

  await deletePlaidItemRow(plaidItemRowId, userId);

  return {
    success: true,
    message: 'Account disconnected successfully',
    wasLastAccount: true,
  };
}

// ---------------------------------------------------------------------------
// IO helpers — private to the module.
// ---------------------------------------------------------------------------

async function loadAccountWithPlaidItem(
  accountId: string,
  userId: string
): Promise<AccountWithPlaidItem> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select(
      `
        id,
        name,
        plaid_item_id,
        plaid_items (
          id,
          item_id,
          access_token
        )
      `
    )
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    logger.error('Account not found', null, { accountId, userId, error: error?.message });
    throw new DisconnectError('Account not found', 404);
  }
  return data as unknown as AccountWithPlaidItem;
}

async function deleteAccount(accountId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId);

  if (error) {
    logger.error('Failed to delete account row', null, {
      accountId,
      userId,
      error: error.message,
    });
    throw new DisconnectError('Failed to delete account from database', 500, error.message);
  }
}

/**
 * Count remaining accounts for the plaid_item. Returns null (not 0) when the
 * count query itself errors — so the caller can distinguish "zero accounts"
 * from "we don't know".
 */
async function countRemainingAccountsForItem(
  plaidItemRowId: string,
  userId: string
): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('plaid_item_id', plaidItemRowId)
    .eq('user_id', userId);

  if (error) {
    logger.error('Error counting remaining accounts', null, {
      plaidItemRowId,
      error: error.message,
    });
    return null;
  }
  return count ?? 0;
}

/**
 * Remove the Plaid item upstream via the /item/remove API. Returns:
 *   - null when removal succeeded (or the item was already dead), so the
 *     caller should proceed with deleting the plaid_items DB row
 *   - a warning string when removal failed with an unexpected Plaid error,
 *     so the caller should skip the DB delete and return it in the response
 */
async function removePlaidItemUpstream(
  accessToken: string,
  plaidItemRowId: string
): Promise<string | null> {
  logger.info('Calling Plaid /item/remove', { plaidItemRowId });

  try {
    // accessToken arrives encrypted from DB; decrypt at the Plaid boundary.
    await removeItem(decryptPlaidToken(accessToken));
    logger.info('Plaid /item/remove succeeded', { plaidItemRowId });
    return null;
  } catch (plaidError) {
    const errorCode = extractPlaidErrorCode(plaidError);
    if (isDeadItemError(errorCode)) {
      logger.warn('Plaid item already dead, proceeding with DB cleanup', {
        plaidItemRowId,
        errorCode,
      });
      return null;
    }
    logger.error('Plaid /item/remove failed unexpectedly', plaidError as Error, {
      plaidItemRowId,
      errorCode,
    });
    return 'Plaid item could not be removed — please reconnect or contact support.';
  }
}

async function deletePlaidItemRow(plaidItemRowId: string, userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('plaid_items')
    .delete()
    .eq('id', plaidItemRowId)
    .eq('user_id', userId);

  if (error) {
    // Non-fatal — the Plaid connection is already removed and the account
    // is already deleted. The orphaned plaid_items row can be cleaned up
    // by a background job. Log it but don't throw.
    logger.warn('Failed to delete orphaned plaid_item row', {
      plaidItemRowId,
      error: error.message,
    });
    return;
  }
  logger.info('Plaid item row deleted', { plaidItemRowId });
}

export { DisconnectError } from './types';
export type { DisconnectAccountParams, DisconnectAccountResult } from './types';
