-- =============================================================================
-- Extend trades table for engine actions
-- Adds source and meta columns to track engine-generated trades
-- =============================================================================

-- Add source column to track trade origin
alter table public.trades
  add column if not exists source text not null default 'engine';

-- Add meta column for additional metadata (JSONB for flexibility)
alter table public.trades
  add column if not exists meta jsonb not null default '{}'::jsonb;

-- Create index for portfolio + executed_at queries (used for today's trades lookup)
create index if not exists idx_trades_portfolio_executed_at
  on public.trades(portfolio_id, executed_at);

-- Partial index for common query pattern: today's executed trades for portfolio
create index if not exists idx_trades_portfolio_executed_at_not_pending
  on public.trades(portfolio_id, executed_at)
  where executed_at is not null and is_pending = false;

-- Add comments for documentation
comment on column public.trades.source is 'Source of the trade: engine, manual, or other';
comment on column public.trades.meta is 'Additional metadata as JSONB (e.g., exit_reason, stop_loss_price, etc.)';

