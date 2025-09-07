-- Create account_snapshots table to track account balance history over time
-- This table stores periodic snapshots of account balances for historical tracking

create table if not exists public.account_snapshots (
  id uuid not null default gen_random_uuid(),
  account_id uuid not null,
  available_balance numeric(15, 2) null,
  current_balance numeric(15, 2) null,
  limit_balance numeric(15, 2) null,
  currency_code text null default 'USD'::text,
  recorded_at timestamptz not null default now(),
  
  constraint account_snapshots_pkey primary key (id),
  constraint account_snapshots_account_id_fkey foreign key (account_id) 
    references accounts (id) on delete cascade
);

-- Create indexes for performance
create index if not exists idx_account_snapshots_account_id 
  on public.account_snapshots using btree (account_id);

create index if not exists idx_account_snapshots_recorded_at 
  on public.account_snapshots using btree (recorded_at);

create index if not exists idx_account_snapshots_account_recorded 
  on public.account_snapshots using btree (account_id, recorded_at);

-- Enable Row Level Security
alter table public.account_snapshots enable row level security;

-- RLS Policies for account_snapshots (user-specific access through accounts table)
-- Users can only view snapshots for their own accounts
drop policy if exists "Users can view own account snapshots" on public.account_snapshots;
create policy "Users can view own account snapshots"
  on public.account_snapshots
  for select
  using (
    exists (
      select 1 from public.accounts 
      where accounts.id = account_snapshots.account_id 
      and accounts.user_id = auth.uid()
    )
  );

-- Users can insert snapshots for their own accounts
drop policy if exists "Users can insert own account snapshots" on public.account_snapshots;
create policy "Users can insert own account snapshots"
  on public.account_snapshots
  for insert
  with check (
    exists (
      select 1 from public.accounts 
      where accounts.id = account_snapshots.account_id 
      and accounts.user_id = auth.uid()
    )
  );

-- Users can update snapshots for their own accounts
drop policy if exists "Users can update own account snapshots" on public.account_snapshots;
create policy "Users can update own account snapshots"
  on public.account_snapshots
  for update
  using (
    exists (
      select 1 from public.accounts 
      where accounts.id = account_snapshots.account_id 
      and accounts.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.accounts 
      where accounts.id = account_snapshots.account_id 
      and accounts.user_id = auth.uid()
    )
  );

-- Users can delete snapshots for their own accounts
drop policy if exists "Users can delete own account snapshots" on public.account_snapshots;
create policy "Users can delete own account snapshots"
  on public.account_snapshots
  for delete
  using (
    exists (
      select 1 from public.accounts 
      where accounts.id = account_snapshots.account_id 
      and accounts.user_id = auth.uid()
    )
  );

-- Add comments for documentation
comment on table public.account_snapshots is 'Historical snapshots of account balances over time';
comment on column public.account_snapshots.account_id is 'Reference to the account this snapshot belongs to';
comment on column public.account_snapshots.available_balance is 'Available balance at time of snapshot';
comment on column public.account_snapshots.current_balance is 'Current balance at time of snapshot';
comment on column public.account_snapshots.limit_balance is 'Credit limit for credit accounts';
comment on column public.account_snapshots.currency_code is 'Currency code for the balances (defaults to USD)';
comment on column public.account_snapshots.recorded_at is 'Timestamp when this snapshot was recorded';
