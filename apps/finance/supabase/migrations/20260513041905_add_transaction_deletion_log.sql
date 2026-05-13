-- Audit log for every transaction Plaid asks us to remove via the
-- /transactions/sync `removed` list. Lets us:
--   1. Know exactly which rows have ever been deleted (and which were
--      protected by the new safeguards instead of deleted) without
--      digging through Axiom logs that age out.
--   2. Recover by re-inserting from this log if we discover something
--      was legitimately needed back.
--
-- Single source of truth for "things Plaid told us to forget". Includes
-- both actual deletions (`deleted = true`) and protected skips
-- (`deleted = false`) so we can spot Plaid behaving badly over time.
CREATE TABLE IF NOT EXISTS public.transaction_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid,
  plaid_item_id uuid,
  plaid_transaction_id text NOT NULL,
  description text,
  merchant_name text,
  amount numeric(12, 2),
  date date,
  was_pending boolean,
  deleted boolean NOT NULL,
  reason text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_deletion_log_user_deleted_at
  ON public.transaction_deletion_log (user_id, deleted_at DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_deletion_log_plaid_tx_id
  ON public.transaction_deletion_log (plaid_transaction_id);

ALTER TABLE public.transaction_deletion_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own log; writes happen via service-role only
-- (the sync orchestrator uses supabaseAdmin, which bypasses RLS).
DROP POLICY IF EXISTS "Users can view own deletion log" ON public.transaction_deletion_log;
CREATE POLICY "Users can view own deletion log"
  ON public.transaction_deletion_log
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.transaction_deletion_log IS
  'Audit log of every transaction Plaid asked us to remove via /transactions/sync. Includes both actual deletions and protected skips so we can spot Plaid bugs and recover lost data.';
