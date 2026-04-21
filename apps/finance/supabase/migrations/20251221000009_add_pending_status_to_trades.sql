-- Add is_pending column to ai_portfolio_trades table
-- This allows orders to be marked as pending when market is closed

alter table public.ai_portfolio_trades
  add column if not exists is_pending boolean not null default false;

-- Make executed_at nullable since pending orders won't have an execution time
alter table public.ai_portfolio_trades
  alter column executed_at drop not null;

-- Add index for querying pending orders
create index if not exists idx_ai_portfolio_trades_is_pending 
  on public.ai_portfolio_trades(is_pending) 
  where is_pending = true;

-- Add index for portfolio_id and is_pending combination
create index if not exists idx_ai_portfolio_trades_portfolio_pending 
  on public.ai_portfolio_trades(portfolio_id, is_pending) 
  where is_pending = true;

-- =============================================================================
-- Add rebalance columns to ai_portfolios table
-- =============================================================================

-- Add rebalance_cadence column (default to 'monthly' for all new portfolios)
alter table public.ai_portfolios
  add column if not exists rebalance_cadence text not null default 'monthly'
  check (rebalance_cadence in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly'));

-- Add previous_rebalance_date to track when we last rebalanced
alter table public.ai_portfolios
  add column if not exists previous_rebalance_date date;

-- Add next_rebalance_date to track when we should rebalance next
alter table public.ai_portfolios
  add column if not exists next_rebalance_date date;

-- Add index for querying portfolios that need rebalancing
create index if not exists idx_ai_portfolios_next_rebalance_date 
  on public.ai_portfolios(next_rebalance_date) 
  where next_rebalance_date is not null;

-- Add index for rebalance_cadence
create index if not exists idx_ai_portfolios_rebalance_cadence 
  on public.ai_portfolios(rebalance_cadence);
