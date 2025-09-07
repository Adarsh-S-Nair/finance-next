-- Create accounts table to store Plaid account data
-- This table stores user's financial accounts linked through Plaid

create table if not exists public.accounts (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null,
  item_id text not null,
  account_id text not null,
  name text not null,
  mask text null,
  type text null,
  subtype text null,
  balances jsonb null,
  access_token text not null,
  account_key text null,
  institution_id uuid null,
  update_success boolean null default true,
  auto_sync boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint accounts_pkey primary key (id),
  constraint accounts_institution_id_fkey foreign key (institution_id) 
    references institutions (id) on delete set null,
  constraint accounts_user_id_fkey foreign key (user_id) 
    references auth.users (id) on delete cascade
);

-- Create indexes for performance
create index if not exists idx_accounts_user_id 
  on public.accounts using btree (user_id);

create index if not exists idx_accounts_item_id 
  on public.accounts using btree (item_id);

create unique index if not exists idx_accounts_item_account 
  on public.accounts using btree (item_id, account_id);

create index if not exists idx_accounts_account_key 
  on public.accounts using btree (account_key);

create index if not exists idx_accounts_institution_id 
  on public.accounts using btree (institution_id);

-- Enable Row Level Security
alter table public.accounts enable row level security;

-- Users can only access their own accounts
drop policy if exists "Users can view own accounts" on public.accounts;
create policy "Users can view own accounts"
  on public.accounts
  for select
  using (auth.uid() = user_id);

-- Users can insert their own accounts
drop policy if exists "Users can insert own accounts" on public.accounts;
create policy "Users can insert own accounts"
  on public.accounts
  for insert
  with check (auth.uid() = user_id);

-- Users can update their own accounts
drop policy if exists "Users can update own accounts" on public.accounts;
create policy "Users can update own accounts"
  on public.accounts
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own accounts
drop policy if exists "Users can delete own accounts" on public.accounts;
create policy "Users can delete own accounts"
  on public.accounts
  for delete
  using (auth.uid() = user_id);

-- Add updated_at trigger
drop trigger if exists accounts_set_updated_at on public.accounts;
create trigger accounts_set_updated_at
  before update on public.accounts
  for each row execute function public.handle_updated_at();

-- Add comments for documentation
comment on table public.accounts is 'User financial accounts linked through Plaid';
comment on column public.accounts.user_id is 'Owner of the account';
comment on column public.accounts.item_id is 'Plaid item identifier';
comment on column public.accounts.account_id is 'Plaid account identifier within the item';
comment on column public.accounts.name is 'Account display name';
comment on column public.accounts.mask is 'Account number mask (e.g., 0000)';
comment on column public.accounts.type is 'Account type (e.g., depository, credit)';
comment on column public.accounts.subtype is 'Account subtype (e.g., checking, savings)';
comment on column public.accounts.balances is 'Account balances from Plaid (JSON)';
comment on column public.accounts.access_token is 'Plaid access token for this item';
comment on column public.accounts.account_key is 'Unique key to prevent duplicate accounts';
comment on column public.accounts.institution_id is 'Reference to institution table';
comment on column public.accounts.update_success is 'Whether last sync was successful';
comment on column public.accounts.auto_sync is 'Whether to automatically sync this account';
