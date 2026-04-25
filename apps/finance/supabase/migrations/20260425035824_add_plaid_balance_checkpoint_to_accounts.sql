-- Plaid balance checkpoint columns.
--
-- Background: /accounts/get returns balances cached by Plaid (typically
-- refreshed once per day by the institution). Until those refresh, the
-- displayed balance lags every transaction we've already pulled in via
-- /transactions/sync. Calling the paid /accounts/balance/get on every
-- sync would solve it but at $0.10/call adds up quickly.
--
-- Solution: separate the *Plaid-vetted checkpoint* from the *displayed
-- balance*. These three columns hold the checkpoint; the existing
-- `balances` JSON now holds the projected (= checkpoint + post-checkpoint
-- posted transactions) value the UI reads.
--
-- The sync code:
--   - Compares Plaid's incoming balance against `plaid_balance_current`.
--     If different, treats it as a fresh checkpoint and overwrites
--     `plaid_balance_*` + bumps `plaid_balance_as_of`.
--   - Always re-projects `balances.current` from
--     `plaid_balance_current ± Σ(amount of posted txs newer than
--     plaid_balance_as_of)`. Sign flips for credit cards.
--
-- Backfill: copy current values from the existing `balances` JSON so
-- the first post-deploy sync starts from a sane checkpoint.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS plaid_balance_current numeric,
  ADD COLUMN IF NOT EXISTS plaid_balance_available numeric,
  ADD COLUMN IF NOT EXISTS plaid_balance_as_of timestamptz;

-- Backfill `as_of` from the most recent account_snapshots.recorded_at
-- (i.e. the last time Plaid was known to confirm a balance for this
-- account). Snapshots are only created on balance changes, so the
-- latest one's timestamp is when Plaid last moved. Anything ingested
-- into `transactions` after that point is by definition not yet in the
-- checkpoint and should project on top.
--
-- Falls back to the account row's own updated_at if there's no
-- snapshot history (newly-linked items haven't snapshotted yet).
UPDATE public.accounts AS a
   SET plaid_balance_current   = (a.balances->>'current')::numeric,
       plaid_balance_available = (a.balances->>'available')::numeric,
       plaid_balance_as_of     = COALESCE(
         (SELECT MAX(s.recorded_at)
            FROM public.account_snapshots s
           WHERE s.account_id = a.id),
         a.updated_at
       )
 WHERE a.balances IS NOT NULL
   AND a.plaid_balance_as_of IS NULL;

COMMENT ON COLUMN public.accounts.plaid_balance_current   IS 'Last vetted current balance from Plaid (the checkpoint). Updated only when Plaid returns a different value.';
COMMENT ON COLUMN public.accounts.plaid_balance_available IS 'Last vetted available balance from Plaid.';
COMMENT ON COLUMN public.accounts.plaid_balance_as_of     IS 'Timestamp of the most recent checkpoint refresh. Posted transactions with date > this::date are projected on top of the checkpoint when computing the displayed balance.';
