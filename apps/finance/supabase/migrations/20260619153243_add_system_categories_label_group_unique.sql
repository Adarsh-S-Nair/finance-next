-- The transaction-sync pipeline seeds newly-discovered system categories with
-- onConflict: 'label,group_id' (ensureSystemCategories in
-- apps/finance/src/lib/plaid/transactionSync/index.ts). That conflict target
-- requires a matching unique constraint, which never existed: every sync that
-- needed to create a brand-new category aborted with Postgres 42P10
-- ("no unique or exclusion constraint matching the ON CONFLICT specification"),
-- silently stalling all transaction sync for the affected Plaid item.
-- Add the missing composite unique constraint so the upsert is valid.
ALTER TABLE public.system_categories
  ADD CONSTRAINT system_categories_label_group_key UNIQUE (label, group_id);
