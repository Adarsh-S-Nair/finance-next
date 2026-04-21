-- =============================================================================
-- Fix Portfolio Cascade Delete
-- Change source_account_id foreign key to cascade delete portfolios when accounts are deleted
-- This ensures that when a Plaid institution is disconnected, all associated portfolios,
-- holdings, trades, and snapshots are automatically deleted
-- =============================================================================

-- Drop the existing foreign key constraint
alter table public.portfolios
  drop constraint if exists portfolios_source_account_id_fkey;

-- Recreate the foreign key with cascade delete
alter table public.portfolios
  add constraint portfolios_source_account_id_fkey
    foreign key (source_account_id)
    references public.accounts(id)
    on delete cascade;

-- Add comment for documentation
comment on constraint portfolios_source_account_id_fkey on public.portfolios is 
  'Cascades delete: when an account is deleted, its associated portfolio is also deleted, which cascades to holdings, trades, and snapshots';

