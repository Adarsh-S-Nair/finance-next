-- =============================================================================
-- Drop Legacy AI Portfolio Tables
-- This migration removes the old ai_* tables that have been replaced by
-- the unified portfolio architecture (portfolios, holdings, trades, portfolio_snapshots)
-- =============================================================================

-- Drop tables in reverse dependency order (child tables first)
-- This ensures foreign key constraints don't prevent deletion

-- Drop ai_portfolio_snapshots (depends on ai_portfolios)
drop table if exists public.ai_portfolio_snapshots cascade;

-- Drop ai_portfolio_trades (depends on ai_portfolios)
drop table if exists public.ai_portfolio_trades cascade;

-- Drop ai_portfolio_holdings (depends on ai_portfolios)
drop table if exists public.ai_portfolio_holdings cascade;

-- Drop ai_portfolios (parent table)
drop table if exists public.ai_portfolios cascade;

-- Note: CASCADE will automatically drop:
-- - All indexes on these tables
-- - All RLS policies on these tables
-- - All foreign key constraints referencing these tables

