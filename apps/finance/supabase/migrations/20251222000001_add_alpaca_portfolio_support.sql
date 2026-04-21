-- Add support for Alpaca-connected portfolios
-- This migration adds a flag to indicate if a portfolio is connected via Alpaca

-- Add boolean column to indicate if portfolio is connected via Alpaca
alter table public.ai_portfolios
  add column if not exists is_alpaca_connected boolean not null default false;

-- Make ai_model nullable (Alpaca portfolios don't need an AI model)
alter table public.ai_portfolios
  alter column ai_model drop not null;

-- Add Alpaca API credentials (encrypted at application level)
alter table public.ai_portfolios
  add column if not exists alpaca_api_key text;
  
alter table public.ai_portfolios
  add column if not exists alpaca_secret_key text;

-- Backfill existing portfolios to set is_alpaca_connected to false
-- (This is technically redundant since default is false, but explicit for clarity)
update public.ai_portfolios
  set is_alpaca_connected = false
  where is_alpaca_connected is null;

-- Add index for is_alpaca_connected
create index if not exists idx_ai_portfolios_is_alpaca_connected 
  on public.ai_portfolios(is_alpaca_connected);

