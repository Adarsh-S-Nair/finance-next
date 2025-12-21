-- AI Trading Simulation Tables
-- These tables support the AI paper trading simulation feature

-- =============================================================================
-- AI PORTFOLIOS - Main portfolio table
-- =============================================================================
create table if not exists public.ai_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  ai_model text not null, -- 'claude-3-opus', 'gpt-4o', 'gemini-pro', etc.
  starting_capital numeric(12, 2) not null default 100000.00,
  current_cash numeric(12, 2) not null default 100000.00,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  created_at timestamptz default now(),
  last_traded_at timestamptz
);

-- Enable RLS
alter table public.ai_portfolios enable row level security;

-- RLS Policies
create policy "Users can view their own AI portfolios"
  on public.ai_portfolios for select
  using (auth.uid() = user_id);

create policy "Users can insert their own AI portfolios"
  on public.ai_portfolios for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own AI portfolios"
  on public.ai_portfolios for update
  using (auth.uid() = user_id);

create policy "Users can delete their own AI portfolios"
  on public.ai_portfolios for delete
  using (auth.uid() = user_id);

-- Indexes
create index idx_ai_portfolios_user_id on public.ai_portfolios(user_id);
create index idx_ai_portfolios_status on public.ai_portfolios(status);

-- =============================================================================
-- AI PORTFOLIO HOLDINGS - Current stock positions
-- =============================================================================
create table if not exists public.ai_portfolio_holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.ai_portfolios(id) on delete cascade not null,
  ticker text not null,
  shares numeric(12, 4) not null,
  avg_cost numeric(12, 4) not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure unique ticker per portfolio
  unique(portfolio_id, ticker)
);

-- Enable RLS
alter table public.ai_portfolio_holdings enable row level security;

-- RLS Policies (access via portfolio ownership)
create policy "Users can view holdings of their portfolios"
  on public.ai_portfolio_holdings for select
  using (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_holdings.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can insert holdings to their portfolios"
  on public.ai_portfolio_holdings for insert
  with check (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_holdings.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can update holdings in their portfolios"
  on public.ai_portfolio_holdings for update
  using (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_holdings.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete holdings from their portfolios"
  on public.ai_portfolio_holdings for delete
  using (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_holdings.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes
create index idx_ai_portfolio_holdings_portfolio_id on public.ai_portfolio_holdings(portfolio_id);
create index idx_ai_portfolio_holdings_ticker on public.ai_portfolio_holdings(ticker);

-- =============================================================================
-- AI PORTFOLIO TRADES - Trade history with AI reasoning
-- =============================================================================
create table if not exists public.ai_portfolio_trades (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.ai_portfolios(id) on delete cascade not null,
  ticker text not null,
  action text not null check (action in ('buy', 'sell')),
  shares numeric(12, 4) not null,
  price numeric(12, 4) not null,
  total_value numeric(12, 2) not null,
  reasoning text, -- AI's explanation for the trade
  executed_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.ai_portfolio_trades enable row level security;

-- RLS Policies
create policy "Users can view trades of their portfolios"
  on public.ai_portfolio_trades for select
  using (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can insert trades to their portfolios"
  on public.ai_portfolio_trades for insert
  with check (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can update trades in their portfolios"
  on public.ai_portfolio_trades for update
  using (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete trades from their portfolios"
  on public.ai_portfolio_trades for delete
  using (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes
create index idx_ai_portfolio_trades_portfolio_id on public.ai_portfolio_trades(portfolio_id);
create index idx_ai_portfolio_trades_executed_at on public.ai_portfolio_trades(executed_at);
create index idx_ai_portfolio_trades_ticker on public.ai_portfolio_trades(ticker);

-- =============================================================================
-- AI PORTFOLIO SNAPSHOTS - Daily value snapshots for charting
-- =============================================================================
create table if not exists public.ai_portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.ai_portfolios(id) on delete cascade not null,
  total_value numeric(12, 2) not null,
  cash numeric(12, 2) not null,
  holdings_value numeric(12, 2) not null,
  snapshot_date date not null,
  created_at timestamptz default now(),
  
  -- One snapshot per portfolio per day
  unique(portfolio_id, snapshot_date)
);

-- Enable RLS
alter table public.ai_portfolio_snapshots enable row level security;

-- RLS Policies
create policy "Users can view snapshots of their portfolios"
  on public.ai_portfolio_snapshots for select
  using (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_snapshots.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can insert snapshots to their portfolios"
  on public.ai_portfolio_snapshots for insert
  with check (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_snapshots.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can update snapshots in their portfolios"
  on public.ai_portfolio_snapshots for update
  using (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_snapshots.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete snapshots from their portfolios"
  on public.ai_portfolio_snapshots for delete
  using (
    exists (
      select 1 from public.ai_portfolios p
      where p.id = ai_portfolio_snapshots.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes
create index idx_ai_portfolio_snapshots_portfolio_id on public.ai_portfolio_snapshots(portfolio_id);
create index idx_ai_portfolio_snapshots_date on public.ai_portfolio_snapshots(snapshot_date);

-- =============================================================================
-- COMMENTS
-- =============================================================================
comment on table public.ai_portfolios is 'AI-managed paper trading portfolios for simulation';
comment on table public.ai_portfolio_holdings is 'Current stock positions held by AI portfolios';
comment on table public.ai_portfolio_trades is 'Historical trades made by AI portfolios with reasoning';
comment on table public.ai_portfolio_snapshots is 'Daily portfolio value snapshots for performance tracking';

