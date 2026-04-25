/**
 * Pure math for the local-projection of an account balance.
 *
 * Background: Plaid's /accounts/get returns balances cached at the
 * institution (typically refreshed once a day). Between those refreshes,
 * /transactions/sync still hands us new posted transactions — so the
 * cached balance lags by however many transactions have come in since
 * Plaid's last cache update.
 *
 * Strategy: store a *checkpoint* (the last value Plaid actually
 * returned, with a timestamp) separately from the *displayed* value.
 * The displayed value is the checkpoint plus every posted transaction
 * we know about that's newer than the checkpoint timestamp.
 *
 * This module owns just the arithmetic. The IO (fetching txs, writing
 * the row) lives in the sync orchestrator.
 */

/**
 * Did Plaid return a different `current` balance than we last
 * checkpointed? If so, the next sync should accept it as the new
 * baseline rather than projecting on top of the old one.
 *
 * `null` previous → first observation → always counts as a change.
 *
 * Equality uses a half-cent epsilon to absorb the rare floating-point
 * artefact (Plaid sends 2-decimal numbers; epsilon avoids treating
 * `1234.56 === 1234.5600000001` as a real change).
 */
export function isCheckpointChange(
  incomingCurrent: number | null,
  previousCurrent: number | null
): boolean {
  if (previousCurrent === null) return true;
  if (incomingCurrent === null) return true;
  return Math.abs(incomingCurrent - previousCurrent) > 0.005;
}

/**
 * Per-account-type sign multiplier for delta application.
 *
 * Our transaction sign convention is universal: spending stored as
 * negative, credits/refunds stored as positive. But what "balance"
 * means flips between account types:
 *
 *   - Depository (checking/savings): balance = money you have. Goes
 *     up when you receive, down when you spend. Tx amount applies
 *     directly (sign = +1).
 *
 *   - Credit: balance = money you owe. Goes up when you spend, down
 *     when you pay/refund. Tx amount must be inverted (sign = -1).
 *
 *   - Loan/mortgage: same logic as credit — balance is what you owe.
 *     Sign = -1.
 *
 *   - Investment: not handled here (holdings sync owns those).
 */
export function projectionSignFor(accountType: string | null | undefined): 1 | -1 {
  if (accountType === 'credit' || accountType === 'loan') return -1;
  return 1;
}

/**
 * Combine a checkpoint with a delta into the projected current value.
 * Rounds to cents to keep the JSON value tidy (avoids 1234.560000001
 * artefacts when summing many fractional amounts).
 */
export function projectCurrent(
  checkpointCurrent: number | null,
  deltaSum: number,
  accountType: string | null | undefined
): number | null {
  if (checkpointCurrent === null) return null;
  const sign = projectionSignFor(accountType);
  const projected = checkpointCurrent + sign * deltaSum;
  return Math.round(projected * 100) / 100;
}

/**
 * The cutoff for "this transaction is newer than the checkpoint" used to
 * be the calendar date column, but a date-based filter has a fatal
 * boundary-day issue: a tx with the same calendar day as the checkpoint
 * either always counts (`>=`, can double-count) or never counts (`>`,
 * silently drops a same-day tx whose creation timestamp is well after
 * the checkpoint).
 *
 * The robust answer is to compare the transaction's `created_at` (when
 * we ingested it from Plaid) against the checkpoint's
 * `plaid_balance_as_of` timestamp. If we received the transaction after
 * Plaid last confirmed a balance, it's by definition newer than that
 * checkpoint and should project. This module no longer exports a
 * date-shrinker because the sync code filters on `created_at` directly.
 */
