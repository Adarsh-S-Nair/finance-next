-- =============================================================================
-- Add portfolio_type column and create trades table
-- Distinguishes between 'trading' and 'investing' portfolios
-- Creates trades table to track completed round-trip trades for trading portfolios
-- =============================================================================

-- =============================================================================
-- Part 1: Add portfolio_type column to portfolios table
-- =============================================================================

-- Add portfolio_type column (default to 'investing' for existing portfolios)
alter table public.portfolios
  add column if not exists portfolio_type text not null default 'investing'
  check (portfolio_type in ('trading', 'investing'));

-- Set existing crypto portfolios to 'trading' type
-- (Assuming crypto portfolios are used for algo trading)
update public.portfolios
  set portfolio_type = 'trading'
  where asset_type = 'crypto';

-- Add index for querying trading portfolios
create index if not exists idx_portfolios_portfolio_type
  on public.portfolios(portfolio_type)
  where portfolio_type = 'trading';

-- Add comment
comment on column public.portfolios.portfolio_type is 'Portfolio type: trading (algo trading with entry/exit) or investing (buy-and-hold)';

-- =============================================================================
-- Part 2: Create trades table
-- =============================================================================

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  
  -- Link to orders that make up this trade
  entry_order_id uuid references public.orders(id) on delete restrict not null,
  exit_order_id uuid references public.orders(id) on delete restrict,
  
  -- Denormalized fields for easy querying (from orders)
  ticker text not null,
  quantity numeric(12, 4) not null,
  entry_price numeric(12, 4) not null,
  exit_price numeric(12, 4),
  
  -- Calculated fields
  realized_pnl numeric(12, 2),  -- (exit_price - entry_price) * quantity
  hold_duration interval,        -- exit.executed_at - entry.executed_at
  
  -- Status
  status text not null default 'open' check (status in ('open', 'closed')),
  
  -- Timestamps
  created_at timestamptz not null default now(),
  closed_at timestamptz  -- when exit_order_id was set (status changed to 'closed')
);

-- Enable RLS
alter table public.trades enable row level security;

-- RLS Policies
create policy "Users can view trades of their portfolios"
  on public.trades for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can insert trades to their portfolios"
  on public.trades for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can update trades in their portfolios"
  on public.trades for update
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete trades from their portfolios"
  on public.trades for delete
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = trades.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Indexes
create index idx_trades_portfolio_id on public.trades(portfolio_id);
create index idx_trades_entry_order_id on public.trades(entry_order_id);
create index idx_trades_exit_order_id on public.trades(exit_order_id);
create index idx_trades_status on public.trades(status);
create index idx_trades_portfolio_status on public.trades(portfolio_id, status);
create index idx_trades_portfolio_open on public.trades(portfolio_id, status)
  where status = 'open';
create index idx_trades_portfolio_closed on public.trades(portfolio_id, status)
  where status = 'closed';

-- Comments
comment on table public.trades is 'Tracks completed round-trip trades (entry -> exit) for trading portfolios. Links entry and exit orders together.';
comment on column public.trades.entry_order_id is 'Reference to the buy order that opened this trade';
comment on column public.trades.exit_order_id is 'Reference to the sell order that closed this trade (NULL when trade is open)';
comment on column public.trades.status is 'Trade status: open (only entry order executed) or closed (both entry and exit orders executed)';
comment on column public.trades.realized_pnl is 'Realized profit/loss: (exit_price - entry_price) * quantity';
comment on column public.trades.hold_duration is 'Time between entry and exit order execution';

