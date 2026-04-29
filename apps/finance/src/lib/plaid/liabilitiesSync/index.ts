/**
 * Liabilities sync orchestrator.
 *
 * Single entry point used by:
 *   - exchange-token after() (via syncRunners.ts)
 *   - the LIABILITIES webhook handler
 *   - POST /api/plaid/liabilities/sync (manual refresh)
 *
 * Pulls Plaid /liabilities/get for one item, maps the response into
 * `liabilities` rows via the pure buildLiabilityRows helper, and upserts.
 *
 * Mirrors the holdingsSync layout: this file is IO only; row shaping is
 * unit-testable in isolation.
 */

import { getLiabilities } from '../client';
import { supabaseAdmin } from '../../supabase/admin';
import { createLogger } from '../../logger';
import { decryptPlaidToken } from '../../crypto/plaidTokens';
import { buildLiabilityRows, type PlaidLiabilitiesResponse } from './buildRows';

const logger = createLogger('liabilities-sync');

export interface LiabilitiesSyncParams {
  plaidItemId: string;
  userId: string;
}

export interface LiabilitiesSyncResult {
  success: boolean;
  liabilities_synced: number;
}

export class LiabilitiesSyncError extends Error {
  httpStatus: number;
  code?: string;
  constructor(message: string, httpStatus: number, code?: string) {
    super(message);
    this.name = 'LiabilitiesSyncError';
    this.httpStatus = httpStatus;
    this.code = code;
  }
}

interface PlaidItemRow {
  id: string;
  user_id: string;
  item_id: string;
  access_token: string;
}

async function loadPlaidItem(plaidItemId: string, userId: string): Promise<PlaidItemRow> {
  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select('id, user_id, item_id, access_token')
    .eq('id', plaidItemId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    logger.error('Plaid item not found', null, { plaidItemId, userId });
    throw new LiabilitiesSyncError('Plaid item not found', 404);
  }
  return data as PlaidItemRow;
}

async function loadAccountsByPlaidItemId(
  plaidItemId: string,
): Promise<Array<{ id: string; account_id: string }>> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('id, account_id')
    .eq('plaid_item_id', plaidItemId);
  if (error) throw error;
  return data ?? [];
}

export async function syncLiabilitiesForItem(
  params: LiabilitiesSyncParams,
): Promise<LiabilitiesSyncResult> {
  const { plaidItemId, userId } = params;
  logger.info('Liabilities sync started', { plaidItemId, userId });

  const plaidItem = await loadPlaidItem(plaidItemId, userId);
  const accessToken = decryptPlaidToken(plaidItem.access_token);
  const accounts = await loadAccountsByPlaidItemId(plaidItem.id);

  const accountIdMap = new Map(accounts.map((a) => [a.account_id, a.id]));

  let response: PlaidLiabilitiesResponse;
  try {
    response = (await getLiabilities(accessToken)) as PlaidLiabilitiesResponse;
  } catch (err) {
    logger.error('Plaid liabilities API call failed', err as Error, { plaidItemId });
    throw err;
  }

  const rows = buildLiabilityRows(response, {
    userId,
    accountIdMap,
    logger: { warn: (msg, data) => logger.warn(msg, data) },
  });

  if (rows.length === 0) {
    logger.info('No liability rows to sync', { plaidItemId });
    return { success: true, liabilities_synced: 0 };
  }

  const { error: upsertError } = await supabaseAdmin
    .from('liabilities')
    .upsert(rows, { onConflict: 'account_id' });

  if (upsertError) {
    logger.error('Failed to upsert liabilities', upsertError as unknown as Error, {
      plaidItemId,
    });
    throw upsertError;
  }

  logger.info('Liabilities sync complete', { plaidItemId, count: rows.length });
  return { success: true, liabilities_synced: rows.length };
}
