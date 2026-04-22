-- Enable Supabase Realtime on plaid_items so the frontend can react
-- instantly when a Plaid webhook completes an initial sync. This
-- replaces/augments client-side polling on /api/plaid/sync-status.
--
-- Why only plaid_items (not accounts or transactions)?
--   plaid_items is the canonical "sync state" table — webhooks flip
--   sync_status and write last_transaction_sync / last_balance_sync
--   here. Any downstream data change (new accounts, new transactions,
--   updated balances) is always preceded by a plaid_items UPDATE.
--   Subscribing to one low-volume table keeps the wire traffic minimal
--   and sidesteps RLS/filtering edge cases on transactions (which has
--   no direct user_id column).
--
-- Why REPLICA IDENTITY FULL?
--   Default replica identity only logs the primary key + changed
--   columns. Clients filter by `user_id=eq.<uid>`, which requires
--   user_id to be present in the WAL record for UPDATE events even
--   when user_id itself isn't changing. FULL ensures every column is
--   logged on every change. Acceptable cost for a small table.

alter table public.plaid_items replica identity full;

alter publication supabase_realtime add table public.plaid_items;
