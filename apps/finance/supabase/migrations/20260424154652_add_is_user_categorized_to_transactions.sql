-- Marks a transaction row as having a user-chosen category. The Plaid
-- sync overwrites category_id with the Personal Finance Category it
-- returns each time it re-delivers a transaction (via DEFAULT_UPDATE /
-- SYNC_UPDATES_AVAILABLE), which was silently reverting categories
-- users had manually set. With this flag, the sync can preserve the
-- existing category_id when is_user_categorized = true instead of
-- blindly overwriting it.
--
-- Default false so existing rows match their current behaviour — only
-- future manual category changes will set this to true.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_user_categorized boolean NOT NULL DEFAULT false;

-- Partial index: the sync path looks up user-categorized rows by
-- plaid_transaction_id during every batch. The filter keeps the index
-- tiny (only rows that matter).
CREATE INDEX IF NOT EXISTS idx_transactions_user_categorized_plaid_tx
  ON public.transactions (plaid_transaction_id)
  WHERE is_user_categorized = true;

COMMENT ON COLUMN public.transactions.is_user_categorized IS
  'True when a user has manually set this row''s category_id. The Plaid sync preserves user_categorized rows rather than overwriting them with the PFC-derived category.';
