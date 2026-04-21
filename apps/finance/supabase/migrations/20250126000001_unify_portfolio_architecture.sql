-- =============================================================================
-- Unified Portfolio Architecture Migration
-- This migration creates unified tables for all portfolio types (AI, Plaid, etc.)
-- and migrates existing AI portfolio data
-- =============================================================================

-- Step 1: Add product_type column to accounts table for tracking data source
alter table public.accounts
  add column if not exists product_type text default 'transactions'
  check (product_type in ('transactions', 'investments'));

-- Add index for product_type queries
create index if not exists idx_accounts_product_type 
  on public.accounts(product_type) 
  where product_type = 'investments';

-- Update existing investment accounts to mark them as legacy
update public.accounts
  set product_type = 'transactions'
  where type = 'investment' and product_type is null;

-- Step 2: Create unified portfolios table
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('ai_simulation', 'plaid_investment', 'alpaca')),
  source_account_id uuid references public.accounts(id) on delete set null,
  -- AI-specific fields (nullable)
  ai_model text,
  status text check (status in ('active', 'paused', 'completed')),
  rebalance_cadence text check (rebalance_cadence in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  previous_rebalance_date date,
  next_rebalance_date date,
  -- Common fields
  starting_capital numeric(12, 2) not null default 100000.00,
  current_cash numeric(12, 2) not null default 100000.00,
  last_traded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.portfolios enable row level security;

-- RLS Policies for portfolios
drop policy if exists "Users can view their own portfolios" on public.portfolios;
create policy "Users can view their own portfolios"
  on public.portfolios for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own portfolios" on public.portfolios;
create policy "Users can insert their own portfolios"
  on public.portfolios for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own portfolios" on public.portfolios;
create policy "Users can update their own portfolios"
  on public.portfolios for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own portfolios" on public.portfolios;
create policy "Users can delete their own portfolios"
  on public.portfolios for delete
  using (auth.uid() = user_id);

-- Indexes for portfolios
create index if not exists idx_portfolios_user_id on public.portfolios(user_id);
create index if not exists idx_portfolios_type on public.portfolios(type);
create index if not exists idx_portfolios_source_account_id on public.portfolios(source_account_id) where source_account_id is not null;
create index if not exists idx_portfolios_status on public.portfolios(status) where status is not null;
create index if not exists idx_portfolios_next_rebalance_date on public.portfolios(next_rebalance_date) where next_rebalance_date is not null;

-- Step 3: Create unified holdings table
create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  ticker text not null,
  shares numeric(12, 4) not null,
  avg_cost numeric(12, 4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure unique ticker per portfolio
  unique(portfolio_id, ticker)
);

-- Enable RLS
alter table public.holdings enable row level security;

-- RLS Policies for holdings (access via portfolio ownership)
drop policy if exists "Users can view holdings of their portfolios" on public.holdings;
create policy "Users can view holdings of their portfolios"
  on public.holdings for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert holdings to their portfolios" on public.holdings;
create policy "Users can insert holdings to their portfolios"
  on public.holdings for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update holdings in their portfolios" on public.holdings;
create policy "Users can update holdings in their portfolios"
  on public.holdings for update
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete holdings from their portfolios" on public.holdings;
create policy "Users can delete holdings from their portfolios"
  on public.holdings for delete
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes for holdings
create index if not exists idx_holdings_portfolio_id on public.holdings(portfolio_id);
create index if not exists idx_holdings_ticker on public.holdings(ticker);

-- Step 4: Create unified trades/orders table
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  ticker text not null,
  action text not null check (action in ('buy', 'sell')),
  shares numeric(12, 4) not null,
  price numeric(12, 4) not null,
  total_value numeric(12, 2) not null,
  -- AI-specific field (nullable)
  reasoning text,
  executed_at timestamptz,
  is_pending boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.trades enable row level security;

-- RLS Policies for trades
drop policy if exists "Users can view trades of their portfolios" on public.trades;
create policy "Users can view trades of their portfolios"
  on public.trades for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert trades to their portfolios" on public.trades;
create policy "Users can insert trades to their portfolios"
  on public.trades for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update trades in their portfolios" on public.trades;
create policy "Users can update trades in their portfolios"
  on public.trades for update
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete trades from their portfolios" on public.trades;
create policy "Users can delete trades from their portfolios"
  on public.trades for delete
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes for trades
create index if not exists idx_trades_portfolio_id on public.trades(portfolio_id);
create index if not exists idx_trades_executed_at on public.trades(executed_at);
create index if not exists idx_trades_ticker on public.trades(ticker);
create index if not exists idx_trades_is_pending on public.trades(is_pending) where is_pending = true;
create index if not exists idx_trades_portfolio_pending on public.trades(portfolio_id, is_pending) where is_pending = true;

-- Step 5: Create unified portfolio_snapshots table
create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  total_value numeric(12, 2) not null,
  cash numeric(12, 2) not null,
  holdings_value numeric(12, 2) not null,
  snapshot_date date not null,
  created_at timestamptz not null default now(),
  
  -- One snapshot per portfolio per day
  unique(portfolio_id, snapshot_date)
);

-- Enable RLS
alter table public.portfolio_snapshots enable row level security;

-- RLS Policies for portfolio_snapshots
drop policy if exists "Users can view snapshots of their portfolios" on public.portfolio_snapshots;
create policy "Users can view snapshots of their portfolios"
  on public.portfolio_snapshots for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_snapshots.portfolio_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert snapshots to their portfolios" on public.portfolio_snapshots;
create policy "Users can insert snapshots to their portfolios"
  on public.portfolio_snapshots for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_snapshots.portfolio_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update snapshots in their portfolios" on public.portfolio_snapshots;
create policy "Users can update snapshots in their portfolios"
  on public.portfolio_snapshots for update
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_snapshots.portfolio_id
      and p.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete snapshots from their portfolios" on public.portfolio_snapshots;
create policy "Users can delete snapshots from their portfolios"
  on public.portfolio_snapshots for delete
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_snapshots.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes for portfolio_snapshots
create index if not exists idx_portfolio_snapshots_portfolio_id on public.portfolio_snapshots(portfolio_id);
create index if not exists idx_portfolio_snapshots_snapshot_date on public.portfolio_snapshots(snapshot_date);
create index if not exists idx_portfolio_snapshots_portfolio_date on public.portfolio_snapshots(portfolio_id, snapshot_date);

-- Step 6: Migrate existing AI portfolio data
-- Migrate ai_portfolios to portfolios
insert into public.portfolios (
  id,
  user_id,
  name,
  type,
  source_account_id,
  ai_model,
  status,
  starting_capital,
  current_cash,
  rebalance_cadence,
  previous_rebalance_date,
  next_rebalance_date,
  last_traded_at,
  created_at,
  updated_at
)
select 
  id,
  user_id,
  name,
  'ai_simulation' as type,
  null as source_account_id, -- AI portfolios don't have source accounts
  ai_model,
  status,
  starting_capital,
  current_cash,
  rebalance_cadence,
  previous_rebalance_date,
  next_rebalance_date,
  last_traded_at,
  created_at,
  created_at as updated_at
from public.ai_portfolios
on conflict (id) do nothing; -- In case migration runs twice

-- Migrate ai_portfolio_holdings to holdings
insert into public.holdings (
  id,
  portfolio_id,
  ticker,
  shares,
  avg_cost,
  created_at,
  updated_at
)
select 
  id,
  portfolio_id,
  ticker,
  shares,
  avg_cost,
  created_at,
  updated_at
from public.ai_portfolio_holdings
on conflict (id) do nothing;

-- Migrate ai_portfolio_trades to trades
insert into public.trades (
  id,
  portfolio_id,
  ticker,
  action,
  shares,
  price,
  total_value,
  reasoning,
  executed_at,
  is_pending,
  created_at
)
select 
  id,
  portfolio_id,
  ticker,
  action,
  shares,
  price,
  total_value,
  reasoning,
  executed_at,
  coalesce(is_pending, false) as is_pending,
  created_at
from public.ai_portfolio_trades
on conflict (id) do nothing;

-- Migrate ai_portfolio_snapshots to portfolio_snapshots
insert into public.portfolio_snapshots (
  id,
  portfolio_id,
  total_value,
  cash,
  holdings_value,
  snapshot_date,
  created_at
)
select 
  id,
  portfolio_id,
  total_value,
  cash,
  holdings_value,
  snapshot_date,
  created_at
from public.ai_portfolio_snapshots
on conflict (id) do nothing;

-- Step 7: Add updated_at trigger for portfolios
drop trigger if exists portfolios_set_updated_at on public.portfolios;
create trigger portfolios_set_updated_at
  before update on public.portfolios
  for each row execute function public.handle_updated_at();

-- Add updated_at trigger for holdings
drop trigger if exists holdings_set_updated_at on public.holdings;
create trigger holdings_set_updated_at
  before update on public.holdings
  for each row execute function public.handle_updated_at();

-- Step 8: Add comments for documentation
comment on table public.portfolios is 'Unified portfolio table for all portfolio types (AI simulations, Plaid investments, Alpaca, etc.)';
comment on column public.portfolios.type is 'Portfolio type: ai_simulation, plaid_investment, or alpaca';
comment on column public.portfolios.source_account_id is 'Reference to accounts table for Plaid investment accounts';
comment on column public.portfolios.ai_model is 'AI model used (only for ai_simulation type)';
comment on column public.portfolios.status is 'Portfolio status: active, paused, completed (only for ai_simulation type)';

comment on table public.holdings is 'Unified holdings table for all portfolio types';
comment on table public.trades is 'Unified trades/orders table for all portfolio types. Previously ai_portfolio_trades.';
comment on column public.trades.reasoning is 'AI reasoning for trade (only for ai_simulation portfolios)';
comment on table public.portfolio_snapshots is 'Unified portfolio snapshots table for historical tracking. Previously ai_portfolio_snapshots.';

-- Note: The old ai_* tables are kept for now but can be dropped in a future migration
-- after verifying all data has been migrated and code has been updated

