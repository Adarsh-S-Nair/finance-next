-- =============================================================================
-- Add asset_type column to portfolios table
-- This migration adds support for crypto portfolios alongside stock portfolios
-- =============================================================================

-- Add asset_type column to portfolios table
alter table public.portfolios
  add column if not exists asset_type text not null default 'stock'
  check (asset_type in ('stock', 'crypto'));

-- Backfill all existing portfolios with 'stock' (since we only had stock portfolios until now)
update public.portfolios
  set asset_type = 'stock'
  where asset_type is null or asset_type = '';

-- Add index for asset_type queries
create index if not exists idx_portfolios_asset_type 
  on public.portfolios(asset_type);

-- Add comment for documentation
comment on column public.portfolios.asset_type is 'Asset type: stock or crypto';

