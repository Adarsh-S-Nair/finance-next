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

/**
 * Should this pending transaction contribute to the balance projection?
 *
 * Background: the original projection assumed Plaid's `current` *always*
 * excludes pending entries, so pending was projected unconditionally. That
 * is not true for one important pattern — **pending credits on depository
 * accounts**.
 *
 * When a bank places a hold on a deposit and later releases it, the
 * hold-release shows up in the transactions feed as a *pending memo
 * credit* (e.g. Chase: "HOLD REL MEM CR"). The underlying deposit has
 * already posted, and Plaid's `current` already reflects the resulting
 * balance — but our code was *also* adding the pending memo on top, so
 * the balance jumped by the deposit amount a second time. A $48k
 * deposit displayed as $96k.
 *
 * The fix is type-aware:
 *
 *   - **Depository, amount > 0**: skip. A pending credit on a checking
 *     or savings account is almost always a hold-release / memo entry
 *     for a deposit that has *already* moved `current`. Truly fresh
 *     incoming credits (wires) typically arrive in `current` as soon
 *     as the bank books them; the worst-case is a 1-day display lag
 *     until Plaid's next refresh, which is far better than 2× over-
 *     counting.
 *
 *   - **Depository, amount < 0**: keep. Card authorizations are
 *     universally not yet in Plaid's `current` and projecting them
 *     gives the user the correct "available after pending" view.
 *
 *   - **Credit / loan, any sign**: keep. Pending charges (negative)
 *     aren't yet in Plaid's `current` (the amount you've been billed),
 *     and projecting them with the credit-side sign flip correctly
 *     raises what you owe. Pending refunds/payments (positive) lower
 *     it.
 */
export function shouldProjectPending(
  amount: number,
  accountType: string | null | undefined
): boolean {
  if (accountType === 'depository' && amount > 0) return false;
  return true;
}

/**
 * Does this depository account need pending-debit projection at all?
 *
 * Background: traditional banks (Chase, Wells, BofA) report two numbers
 * that mean different things — `current` is settled funds, `available`
 * is `current` minus outstanding pending debits. While pending charges
 * exist, `available < current`, and the projection layer recreates
 * "available after pending" by subtracting the pending tx feed from the
 * checkpoint.
 *
 * Modern fintechs (Venmo, Cash App, most neobanks) don't track a
 * settled/available distinction — money moves in real time, and Plaid
 * relays a single number as both `current` and `available`. The
 * `pending` flag on a transaction is metadata about Plaid's view of
 * settlement state, NOT a signal that the amount hasn't been deducted
 * from balance yet. Projecting pending on top of `current` here
 * double-counts the spend.
 *
 * The signal: when Plaid returns `current === available`, the
 * institution is telling us "what you see is what you can spend." Skip
 * pending projection — the checkpoint already reflects every charge,
 * settled or not.
 *
 * Conservative defaults: if either value is null, project (we'd rather
 * show a slightly low balance than a wildly inflated one). The half-
 * cent epsilon mirrors `isCheckpointChange`.
 *
 * Only meaningful for depository accounts. Credit cards have
 * `available = limit - current` (different semantics entirely), so this
 * comparison would always say "skip" and silently break credit-card
 * pending projection. Callers must gate on account type.
 */
export function shouldProjectPendingForDepository(
  plaidCurrent: number | null,
  plaidAvailable: number | null
): boolean {
  if (plaidCurrent === null) return true;
  if (plaidAvailable === null) return true;
  return Math.abs(plaidCurrent - plaidAvailable) > 0.005;
}

/**
 * End-to-end balance projection. Combines the checkpoint, posted-tx
 * deltas, and pending-tx contributions into the displayed `current`
 * value, applying all the type- and institution-aware rules above.
 *
 * Pure function so we can exercise the full math under test without
 * spinning up Supabase mocks. The orchestrator in `index.ts` is the
 * thin shell that handles I/O (fetching txs, persisting the row).
 *
 *   - `checkpointCurrent` — the stored Plaid checkpoint, or the just-
 *     incoming value if it's a fresh checkpoint. Null disables
 *     projection entirely (returns null).
 *   - `checkpointAvailable` — the corresponding `available` value from
 *     Plaid. Used only for the depository real-time-institution check.
 *   - `accountType` — depository / credit / loan / null-or-other.
 *   - `postedDeltaSum` — sum of posted tx amounts with `date > as_of`.
 *     Caller is responsible for the date filter; this function trusts
 *     it.
 *   - `pendingAmounts` — amounts of every pending tx the caller wants
 *     to consider. Per-tx and institution-level filtering applied here.
 */
export interface ProjectedBalanceInputs {
  checkpointCurrent: number | null;
  checkpointAvailable: number | null;
  accountType: string | null | undefined;
  postedDeltaSum: number;
  pendingAmounts: number[];
}

export function computeProjectedBalance(
  inputs: ProjectedBalanceInputs
): number | null {
  const {
    checkpointCurrent,
    checkpointAvailable,
    accountType,
    postedDeltaSum,
    pendingAmounts,
  } = inputs;

  if (checkpointCurrent === null) return null;

  const skipPendingForRealtimeInstitution =
    accountType === 'depository' &&
    !shouldProjectPendingForDepository(checkpointCurrent, checkpointAvailable);

  let pendingSum = 0;
  if (!skipPendingForRealtimeInstitution) {
    for (const amount of pendingAmounts) {
      if (!shouldProjectPending(amount, accountType)) continue;
      pendingSum += amount;
    }
  }

  return projectCurrent(
    checkpointCurrent,
    postedDeltaSum + pendingSum,
    accountType
  );
}
