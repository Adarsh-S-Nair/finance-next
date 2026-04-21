-- =============================================================================
-- Add crypto_assets column to portfolios table and asset_type to tickers table
-- This migration adds support for storing selected crypto assets for crypto portfolios
-- and adds asset_type to distinguish between stock and crypto tickers
-- =============================================================================

-- Add crypto_assets column to portfolios table (JSON array of crypto symbols)
alter table public.portfolios
  add column if not exists crypto_assets jsonb default '[]'::jsonb;

-- Add comment for documentation
comment on column public.portfolios.crypto_assets is 'Array of crypto symbols (e.g., ["BTC", "ETH"]) for crypto portfolios';

-- Add index for crypto_assets queries (GIN index for JSONB)
create index if not exists idx_portfolios_crypto_assets 
  on public.portfolios using gin (crypto_assets);

-- Add asset_type column to tickers table
alter table public.tickers
  add column if not exists asset_type text not null default 'stock'
  check (asset_type in ('stock', 'crypto'));

-- Backfill all existing tickers with 'stock' (since we only had stock tickers until now)
update public.tickers
  set asset_type = 'stock'
  where asset_type is null or asset_type = '';

-- Add index for asset_type queries
create index if not exists idx_tickers_asset_type 
  on public.tickers(asset_type);

-- Add comment for documentation
comment on column public.tickers.asset_type is 'Asset type: stock or crypto';

