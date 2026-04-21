/**
 * Shared helper: load a plaid_items row by Plaid's `item_id`.
 *
 * Every webhook handler needs to do this as its first step — extract it
 * so the individual handlers stay focused on their event-specific logic.
 */

import { supabaseAdmin } from '../../supabase/admin';
import type { PlaidItemContext, WebhookLogger } from './types';

/**
 * Load a plaid_items row by the Plaid `item_id`, returning the narrow
 * `PlaidItemContext` shape that handlers consume.
 *
 * Logs and returns null on any failure — webhook handlers should bail out
 * when this returns null (there's nothing actionable they can do with a
 * webhook for an unknown item).
 */
export async function loadPlaidItemByItemId(
  plaidItemId: string,
  logger: WebhookLogger
): Promise<PlaidItemContext | null> {
  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select('id, user_id, item_id, access_token')
    .eq('item_id', plaidItemId)
    .single();

  if (error || !data) {
    logger.error('Plaid item not found for webhook', null, {
      item_id: plaidItemId,
      error,
    });
    return null;
  }

  return data as PlaidItemContext;
}
