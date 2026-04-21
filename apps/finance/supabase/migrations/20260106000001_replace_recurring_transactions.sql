-- Migration: Replace custom recurring_transactions with Plaid recurring_streams
-- This drops the old table and creates a new one aligned with Plaid's /transactions/recurring/get API

-- ============================================================================
-- 1. Drop old recurring_transactions table and related objects
-- ============================================================================

-- Drop trigger
drop trigger if exists recurring_transactions_set_updated_at on public.recurring_transactions;

-- Drop policies
drop policy if exists "Users can view own recurring transactions" on public.recurring_transactions;
drop policy if exists "Users can insert own recurring transactions" on public.recurring_transactions;
drop policy if exists "Users can update own recurring transactions" on public.recurring_transactions;
drop policy if exists "Users can delete own recurring transactions" on public.recurring_transactions;

-- Drop indexes
drop index if exists idx_recurring_transactions_user_id;
drop index if exists idx_recurring_transactions_next_date;

-- Drop table
drop table if exists public.recurring_transactions;

-- ============================================================================
-- 2. Create new recurring_streams table
-- ============================================================================

create table if not exists public.recurring_streams (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plaid_item_id uuid references public.plaid_items(id) on delete cascade,
  account_id text not null,
  
  -- Plaid stream identifiers
  stream_id text not null,
  stream_type text not null check (stream_type in ('inflow', 'outflow')),
  
  -- Stream details
  description text not null,
  merchant_name text,
  
  -- Recurrence pattern
  frequency text not null check (frequency in ('WEEKLY', 'BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY', 'ANNUALLY', 'UNKNOWN')),
  status text not null check (status in ('MATURE', 'EARLY_DETECTION', 'TOMBSTONED', 'UNKNOWN')),
  is_active boolean not null default true,
  
  -- Dates
  first_date date not null,
  last_date date not null,
  predicted_next_date date,
  
  -- Amounts (stored as absolute values)
  average_amount numeric(12, 2) not null,
  last_amount numeric(12, 2) not null,
  iso_currency_code text not null default 'USD',
  
  -- Category (Plaid Personal Finance Category)
  category_primary text,
  category_detailed text,
  
  -- Linked transactions
  transaction_ids text[] not null default '{}',
  
  -- Timestamps
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  
  constraint recurring_streams_pkey primary key (id),
  constraint recurring_streams_stream_id_unique unique (stream_id)
);

-- ============================================================================
-- 3. Create indexes
-- ============================================================================

create index if not exists idx_recurring_streams_user_id 
  on public.recurring_streams using btree (user_id);

create index if not exists idx_recurring_streams_user_type_active 
  on public.recurring_streams using btree (user_id, stream_type, is_active);

create index if not exists idx_recurring_streams_plaid_item 
  on public.recurring_streams using btree (plaid_item_id);

create index if not exists idx_recurring_streams_next_date 
  on public.recurring_streams using btree (predicted_next_date);

-- ============================================================================
-- 4. Enable RLS and create policies
-- ============================================================================

alter table public.recurring_streams enable row level security;

-- Select policy
drop policy if exists "Users can view own recurring streams" on public.recurring_streams;
create policy "Users can view own recurring streams"
  on public.recurring_streams
  for select
  using (auth.uid() = user_id);

-- Insert policy (for sync API)
drop policy if exists "Users can insert own recurring streams" on public.recurring_streams;
create policy "Users can insert own recurring streams"
  on public.recurring_streams
  for insert
  with check (auth.uid() = user_id);

-- Update policy
drop policy if exists "Users can update own recurring streams" on public.recurring_streams;
create policy "Users can update own recurring streams"
  on public.recurring_streams
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Delete policy
drop policy if exists "Users can delete own recurring streams" on public.recurring_streams;
create policy "Users can delete own recurring streams"
  on public.recurring_streams
  for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- 5. Trigger for synced_at timestamp
-- ============================================================================

drop trigger if exists recurring_streams_set_synced_at on public.recurring_streams;
create trigger recurring_streams_set_synced_at
  before update on public.recurring_streams
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- 6. Table comment
-- ============================================================================

comment on table public.recurring_streams is 'Recurring transaction streams from Plaid /transactions/recurring/get API';
comment on column public.recurring_streams.stream_type is 'inflow = income/deposits, outflow = expenses/bills';
comment on column public.recurring_streams.frequency is 'WEEKLY, BIWEEKLY, SEMI_MONTHLY, MONTHLY, ANNUALLY, or UNKNOWN';
comment on column public.recurring_streams.status is 'MATURE (3+ transactions), EARLY_DETECTION (new), TOMBSTONED (cancelled), UNKNOWN';
