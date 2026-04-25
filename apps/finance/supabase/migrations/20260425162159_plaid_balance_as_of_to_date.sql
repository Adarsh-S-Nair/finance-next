-- Switch `plaid_balance_as_of` from a timestamp to a calendar date,
-- and restore meaningful values for each account.
--
-- Background. Plaid exposes two independent endpoints with independent
-- staleness:
--
--   - /transactions/sync — fresh, near-real-time tx feed.
--   - /accounts/get      — institution-cached balance, refreshes
--                          ~once a day at end-of-business.
--
-- The `current` value Plaid returns is structurally a *daily* number
-- (the bank rolls its books at end-of-day). So "as of which date did
-- Plaid last move our checkpoint" maps cleanly to "all txs *posted*
-- after that date are not yet in the cache" — and we should project
-- them on top.
--
-- An earlier iteration tried `created_at > as_of_timestamp` with as_of
-- bumped on every fetch. That over-corrected: when Plaid's cache lags
-- (which is the *whole reason* we project), as_of advances each sync
-- and we never project. Result: yesterday's tax refund silently dropped
-- off the displayed balance because Plaid hadn't yet refreshed the
-- cached balance to include it.
--
-- The right semantics: as_of is the *date* Plaid's `current` last
-- moved. It only advances when the value actually changes. Projection
-- compares `tx.date` (a date) to `plaid_balance_as_of` (now also a
-- date), strict greater-than. Same-day boundary txs lag by ~1 day in
-- the worst case, which is acceptable; the alternative was silent
-- double- or single-counting of full transaction amounts.
--
-- This migration:
--   1. Converts the column type from timestamptz to date (truncates
--      time-of-day; existing data is preserved as the date portion).
--   2. Restores each account's `as_of` to the date of the most recent
--      account_snapshot whose `current_balance` matches the stored
--      `plaid_balance_current` (within a half-cent epsilon). That
--      snapshot is, by definition, when Plaid last vetted exactly the
--      value we currently hold as the checkpoint.
--   3. Falls back to the most recent snapshot date if no exact match
--      exists, then to today if there are no snapshots at all.
--
-- Investment accounts are skipped (holdings sync owns their balances).

ALTER TABLE public.accounts
  ALTER COLUMN plaid_balance_as_of TYPE date
  USING plaid_balance_as_of::date;

UPDATE public.accounts AS a
   SET plaid_balance_as_of = COALESCE(
     -- Prefer: the date of the most recent snapshot whose value matches
     -- the current checkpoint. That's when Plaid vetted exactly this
     -- number, so projecting txs with date > that snapshot's date is
     -- the cleanest predicate for "ingested since the last vetted
     -- balance".
     (SELECT MAX(s.recorded_at)::date
        FROM public.account_snapshots s
       WHERE s.account_id = a.id
         AND a.plaid_balance_current IS NOT NULL
         AND s.current_balance IS NOT NULL
         AND ABS(s.current_balance - a.plaid_balance_current) < 0.005),
     -- Fallback 1: the most recent snapshot date regardless of value.
     -- Better than nothing — most snapshots are reasonably aligned with
     -- balance changes.
     (SELECT MAX(s.recorded_at)::date
        FROM public.account_snapshots s
       WHERE s.account_id = a.id),
     -- Fallback 2: today. No snapshot history → assume the current
     -- value is fresh as of now. Worst case: nothing projects until the
     -- next genuine checkpoint move, but no double-counting either.
     CURRENT_DATE
   )
 WHERE a.plaid_balance_current IS NOT NULL
   AND a.type IS DISTINCT FROM 'investment';

COMMENT ON COLUMN public.accounts.plaid_balance_as_of IS 'Calendar date Plaid''s `current` was last vetted at the stored `plaid_balance_current` value. Posted transactions with `date > plaid_balance_as_of` are projected on top of the checkpoint when computing the displayed balance. Only advances when the checkpoint value actually changes.';
