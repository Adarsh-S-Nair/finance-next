-- =============================================================================
-- Add arbitrage portfolio support
-- This migration adds support for crypto arbitrage simulation portfolios
-- =============================================================================

-- Step 1: Update portfolios type constraint to include arbitrage_simulation
-- First, drop the existing constraint
alter table public.portfolios
  drop constraint if exists portfolios_type_check;

-- Add new constraint with arbitrage_simulation
alter table public.portfolios
  add constraint portfolios_type_check
  check (type in ('ai_simulation', 'plaid_investment', 'alpaca', 'arbitrage_simulation'));

-- Step 2: Add metadata JSONB column for flexible configuration storage
alter table public.portfolios
  add column if not exists metadata jsonb default '{}'::jsonb;

-- Add comment for documentation
comment on column public.portfolios.metadata is 'Flexible JSON storage for portfolio-specific configuration (e.g., exchanges for arbitrage)';

-- Add index for metadata queries (GIN index for JSONB)
create index if not exists idx_portfolios_metadata
  on public.portfolios using gin (metadata);

-- Step 3: Create exchange_balances table for tracking per-exchange balances in arbitrage
create table if not exists public.exchange_balances (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  exchange text not null,
  currency text not null default 'USD',
  balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One balance per exchange per currency per portfolio
  unique(portfolio_id, exchange, currency)
);

-- Enable RLS
alter table public.exchange_balances enable row level security;

-- RLS Policies for exchange_balances
create policy "Users can view exchange balances of their portfolios"
  on public.exchange_balances for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = exchange_balances.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can insert exchange balances to their portfolios"
  on public.exchange_balances for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = exchange_balances.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can update exchange balances in their portfolios"
  on public.exchange_balances for update
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = exchange_balances.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete exchange balances from their portfolios"
  on public.exchange_balances for delete
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = exchange_balances.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes for exchange_balances
create index if not exists idx_exchange_balances_portfolio_id on public.exchange_balances(portfolio_id);
create index if not exists idx_exchange_balances_exchange on public.exchange_balances(exchange);

-- Add updated_at trigger for exchange_balances
drop trigger if exists exchange_balances_set_updated_at on public.exchange_balances;
create trigger exchange_balances_set_updated_at
  before update on public.exchange_balances
  for each row execute function public.handle_updated_at();

-- Comments
comment on table public.exchange_balances is 'Tracks USD and crypto balances per exchange for arbitrage portfolios';
comment on column public.exchange_balances.exchange is 'Exchange identifier (e.g., binance, coinbase, kraken)';
comment on column public.exchange_balances.currency is 'Currency (USD, BTC, ETH, etc.)';
comment on column public.exchange_balances.balance is 'Current balance amount';

-- Step 4: Create arbitrage_trades table for tracking arbitrage transactions
create table if not exists public.arbitrage_trades (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,

  -- Trade details
  crypto text not null,
  quantity numeric(16, 8) not null,

  -- Buy side
  buy_exchange text not null,
  buy_price numeric(12, 4) not null,
  buy_total numeric(12, 2) not null,

  -- Sell side
  sell_exchange text not null,
  sell_price numeric(12, 4) not null,
  sell_total numeric(12, 2) not null,

  -- Profit/Loss
  spread_percent numeric(8, 4) not null,
  profit numeric(12, 2) not null,
  fees numeric(12, 2) not null default 0,
  net_profit numeric(12, 2) not null,

  -- Status
  status text not null default 'completed' check (status in ('pending', 'completed', 'failed')),

  -- Timestamps
  executed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.arbitrage_trades enable row level security;

-- RLS Policies for arbitrage_trades
create policy "Users can view arbitrage trades of their portfolios"
  on public.arbitrage_trades for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = arbitrage_trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can insert arbitrage trades to their portfolios"
  on public.arbitrage_trades for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = arbitrage_trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can update arbitrage trades in their portfolios"
  on public.arbitrage_trades for update
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = arbitrage_trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete arbitrage trades from their portfolios"
  on public.arbitrage_trades for delete
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = arbitrage_trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes for arbitrage_trades
create index if not exists idx_arbitrage_trades_portfolio_id on public.arbitrage_trades(portfolio_id);
create index if not exists idx_arbitrage_trades_crypto on public.arbitrage_trades(crypto);
create index if not exists idx_arbitrage_trades_executed_at on public.arbitrage_trades(executed_at);
create index if not exists idx_arbitrage_trades_status on public.arbitrage_trades(status);

-- Comments
comment on table public.arbitrage_trades is 'Tracks completed arbitrage trades (buy on one exchange, sell on another)';
comment on column public.arbitrage_trades.spread_percent is 'Price spread percentage between exchanges at time of trade';
comment on column public.arbitrage_trades.profit is 'Gross profit before fees';
comment on column public.arbitrage_trades.net_profit is 'Net profit after fees';
