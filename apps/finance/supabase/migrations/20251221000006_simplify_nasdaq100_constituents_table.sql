-- Simplify NASDAQ-100 Constituents Table
-- Remove columns that will be stored in separate market data tables
-- Keep only: ticker, name, added_at, removed_at, updated_at

alter table public.nasdaq100_constituents
  drop column if exists sector,
  drop column if exists industry,
  drop column if exists market_cap,
  drop column if exists weight;

-- Comments
comment on table public.nasdaq100_constituents is 'NASDAQ-100 index constituents - simplified to ticker, name, and status tracking. Market data stored separately.';

