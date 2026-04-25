-- Recovery migration for the balance-projection bug introduced in
-- 20260425035824_add_plaid_balance_checkpoint_to_accounts.sql.
--
-- The original migration backfilled `plaid_balance_as_of` from
-- MAX(account_snapshots.recorded_at), but snapshots are only created when
-- *both* date and balance differ from the previous snapshot
-- (see lib/accountSnapshotUtils.ts). That timestamp is therefore
-- "when the balance last changed", not "when the balance was last fetched".
--
-- Plaid's /accounts/get and /transactions/sync are independent endpoints
-- with independent staleness. A real transaction can post via
-- /transactions/sync at time T+1 even though /accounts/get already
-- returned a balance at time T that *already reflected it* (the
-- institution updated its balance cache before the tx flowed through to
-- Plaid's transactions feed). When that happens, the tx's `created_at`
-- can be greater than the latest snapshot timestamp, and the projector
-- subtracts it on top of a checkpoint that already includes it —
-- double-counting.
--
-- That's how Robinhood Checking ended up displaying -$4378 (= $2622
-- checkpoint − $7000 already-reflected check).
--
-- Recovery:
--   1. `plaid_balance_current` is *not* corrupted (the projection writes
--      to `balances.current`, never `plaid_balance_current`). Use it as
--      the source of truth and restore `balances.current` from it.
--   2. Stamp `plaid_balance_as_of = NOW()` so the next sync starts from
--      a clean slate. Going forward, the application code bumps as_of on
--      every successful Plaid balance fetch (not just on value changes),
--      so this stays correct.
--
-- Investment accounts are skipped: the projection path explicitly skips
-- them (holdings sync owns those balances), so their `balances.current`
-- was never touched by the buggy code.

UPDATE public.accounts
   SET balances           = jsonb_set(
                              COALESCE(balances, '{}'::jsonb),
                              '{current}',
                              to_jsonb(plaid_balance_current),
                              true
                            ),
       plaid_balance_as_of = now(),
       updated_at          = now()
 WHERE plaid_balance_current IS NOT NULL
   AND type IS DISTINCT FROM 'investment';
