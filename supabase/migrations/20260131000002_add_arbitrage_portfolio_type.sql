-- =============================================================================
-- Add 'arbitrage' to portfolio_type constraint
-- =============================================================================

-- Drop the existing constraint
alter table public.portfolios
  drop constraint if exists portfolios_portfolio_type_check;

-- Add new constraint with 'arbitrage' option
alter table public.portfolios
  add constraint portfolios_portfolio_type_check
  check (portfolio_type in ('trading', 'investing', 'arbitrage'));
