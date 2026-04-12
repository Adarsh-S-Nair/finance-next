/**
 * Pure helpers for classifying Plaid API errors during /item/remove.
 *
 * Plaid returns several error codes that all mean "this item is already
 * effectively gone" — if we treat any of them as hard failures, we'd
 * leave users unable to disconnect an account just because Plaid has
 * already forgotten about it.
 */

/**
 * Plaid error codes that indicate the item is already dead. When /item/remove
 * returns one of these, we log a warning and proceed with DB cleanup as
 * if the Plaid call had succeeded.
 */
export const DEAD_ITEM_ERROR_CODES = [
  'ITEM_NOT_FOUND',
  'INVALID_ACCESS_TOKEN',
  'ITEM_LOGIN_REQUIRED',
] as const;

export type DeadItemErrorCode = (typeof DEAD_ITEM_ERROR_CODES)[number];

/**
 * Is this Plaid error code one we can ignore because the item is already
 * unusable? A null/undefined code is NOT treated as dead — we only suppress
 * errors we've explicitly enumerated.
 */
export function isDeadItemError(errorCode: string | null | undefined): boolean {
  if (!errorCode) return false;
  return (DEAD_ITEM_ERROR_CODES as readonly string[]).includes(errorCode);
}

/**
 * Extract a Plaid error code from an arbitrary thrown value. Plaid SDK errors
 * shape: `err.response.data.error_code`. Returns null if the shape doesn't
 * match — the caller should then treat it as a non-Plaid error.
 */
export function extractPlaidErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const maybe = err as { response?: { data?: { error_code?: string } } };
  return maybe.response?.data?.error_code ?? null;
}
