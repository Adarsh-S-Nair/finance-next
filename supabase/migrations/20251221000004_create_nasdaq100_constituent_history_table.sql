-- NASDAQ-100 Constituent History Table
-- Tracks all additions and removals for audit trail
-- Never updates, only inserts - preserves complete history

create table if not exists public.nasdaq100_constituent_history (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  action text not null check (action in ('added', 'removed')),
  effective_date date not null, -- When the change took effect
  synced_at timestamptz default now(), -- When we detected/synced this change
  notes text, -- Optional notes about the change
  created_at timestamptz default now()
);

-- Indexes for fast lookups
create index idx_nasdaq100_constituent_history_ticker on public.nasdaq100_constituent_history(ticker);
create index idx_nasdaq100_constituent_history_date on public.nasdaq100_constituent_history(effective_date);
create index idx_nasdaq100_constituent_history_action on public.nasdaq100_constituent_history(action);

-- Enable RLS
alter table public.nasdaq100_constituent_history enable row level security;

-- RLS Policy: All authenticated users can read history
create policy "Authenticated users can view NASDAQ-100 constituent history"
  on public.nasdaq100_constituent_history for select
  using (auth.role() = 'authenticated');

-- Comments
comment on table public.nasdaq100_constituent_history is 'Complete audit trail of all NASDAQ-100 constituent changes (additions and removals)';

