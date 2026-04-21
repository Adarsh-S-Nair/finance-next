-- =============================================================================
-- Cleanup Plaid Investment Portfolios
-- Delete all existing plaid_investment portfolios to clean up test data
-- This will cascade delete all associated holdings, trades, and snapshots
-- =============================================================================

-- Delete all portfolios with type 'plaid_investment'
-- This will cascade delete:
--   - All holdings (via holdings.portfolio_id on delete cascade)
--   - All trades (via trades.portfolio_id on delete cascade)
--   - All portfolio_snapshots (via portfolio_snapshots.portfolio_id on delete cascade)
delete from public.portfolios
where type = 'plaid_investment';

-- Log the cleanup (this will be visible in migration logs)
do $$
declare
  deleted_count integer;
begin
  get diagnostics deleted_count = row_count;
  raise notice 'Cleaned up % plaid_investment portfolio(s) and all associated data', deleted_count;
end $$;

