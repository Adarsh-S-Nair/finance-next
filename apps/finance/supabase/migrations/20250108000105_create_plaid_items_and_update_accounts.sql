-- Create plaid_items table and update accounts table to reference it
-- This migration creates a proper plaid_items table for managing Plaid item state
-- and updates the accounts table to use a foreign key relationship

-- Create plaid_items table
create table if not exists public.plaid_items (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  item_id text not null,
  access_token text not null,
  transaction_cursor text null,
  last_transaction_sync timestamptz null,
  last_balance_sync timestamptz null,
  sync_status text null default 'idle'::text,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint plaid_items_pkey primary key (id),
  constraint plaid_items_user_id_item_id_key unique (user_id, item_id),
  constraint plaid_items_user_id_fkey foreign key (user_id) 
    references auth.users (id) on delete cascade
);

-- Create indexes for plaid_items
create index if not exists idx_plaid_items_user_id 
  on public.plaid_items using btree (user_id);

create index if not exists idx_plaid_items_item_id 
  on public.plaid_items using btree (item_id);

create index if not exists idx_plaid_items_last_transaction_sync 
  on public.plaid_items using btree (last_transaction_sync);

create index if not exists idx_plaid_items_sync_status 
  on public.plaid_items using btree (sync_status);

-- Enable Row Level Security for plaid_items
alter table public.plaid_items enable row level security;

-- RLS Policies for plaid_items (user-specific access)
-- Users can only view their own plaid items
drop policy if exists "Users can view own plaid items" on public.plaid_items;
create policy "Users can view own plaid items"
  on public.plaid_items
  for select
  using (auth.uid() = user_id);

-- Users can insert their own plaid items
drop policy if exists "Users can insert own plaid items" on public.plaid_items;
create policy "Users can insert own plaid items"
  on public.plaid_items
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own plaid items
drop policy if exists "Users can update own plaid items" on public.plaid_items;
create policy "Users can update own plaid items"
  on public.plaid_items
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own plaid items
drop policy if exists "Users can delete own plaid items" on public.plaid_items;
create policy "Users can delete own plaid items"
  on public.plaid_items
  for delete
  using (auth.uid() = user_id);

-- Add updated_at trigger for plaid_items
drop trigger if exists plaid_items_set_updated_at on public.plaid_items;
create trigger plaid_items_set_updated_at
  before update on public.plaid_items
  for each row execute function public.handle_updated_at();

-- Now update the accounts table to reference plaid_items
-- First, add the new plaid_item_id column
alter table public.accounts 
add column if not exists plaid_item_id uuid null;

-- Create foreign key constraint to plaid_items
do $$
begin
    if not exists (
        select 1 from information_schema.table_constraints 
        where constraint_name = 'accounts_plaid_item_id_fkey' 
        and table_name = 'accounts'
        and table_schema = 'public'
    ) then
        alter table public.accounts 
        add constraint accounts_plaid_item_id_fkey 
        foreign key (plaid_item_id) references plaid_items (id) on delete cascade;
    end if;
end $$;

-- Create index for the new foreign key
create index if not exists idx_accounts_plaid_item_id 
  on public.accounts using btree (plaid_item_id);

-- Update the unique constraint to use plaid_item_id instead of item_id
-- First drop the old constraint
drop index if exists idx_accounts_item_account;

-- Create new unique constraint using plaid_item_id and account_id
create unique index if not exists idx_accounts_plaid_item_account 
  on public.accounts using btree (plaid_item_id, account_id);

-- Add comments for documentation
comment on table public.plaid_items is 'Plaid items for managing sync state and access tokens';
comment on column public.plaid_items.user_id is 'Owner of the plaid item';
comment on column public.plaid_items.item_id is 'Plaid item identifier';
comment on column public.plaid_items.access_token is 'Plaid access token for this item';
comment on column public.plaid_items.transaction_cursor is 'Cursor for incremental transaction sync';
comment on column public.plaid_items.last_transaction_sync is 'Last successful transaction sync timestamp';
comment on column public.plaid_items.last_balance_sync is 'Last successful balance sync timestamp';
comment on column public.plaid_items.sync_status is 'Current sync status (idle, syncing, error)';
comment on column public.plaid_items.last_error is 'Last error message if sync failed';

comment on column public.accounts.plaid_item_id is 'Reference to plaid_items table for sync management';
