-- =============================================================================
-- Create crypto_candles table with retention policies
-- This migration creates a table for storing OHLCV candle data for crypto assets
-- at multiple intervals (1m, 5m, 1h, 1d) with automatic retention-based pruning
-- =============================================================================

-- Create crypto_candles table
create table if not exists public.crypto_candles (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  timeframe text not null,
  time timestamptz not null,
  open double precision not null,
  high double precision not null,
  low double precision not null,
  close double precision not null,
  volume double precision null,
  created_at timestamptz not null default now(),
  
  -- Unique constraint for idempotent upserts
  constraint crypto_candles_product_timeframe_time_unique 
    unique (product_id, timeframe, time),
  
  -- Validate timeframe values
  constraint crypto_candles_timeframe_check 
    check (timeframe in ('1m', '5m', '1h', '1d'))
);

-- Index for fast chart queries (most recent first)
create index if not exists idx_crypto_candles_product_timeframe_time 
  on public.crypto_candles(product_id, timeframe, time desc);

-- Index for retention pruning queries (by timeframe and time)
create index if not exists idx_crypto_candles_timeframe_time 
  on public.crypto_candles(timeframe, time);

-- Add table comment
comment on table public.crypto_candles is 'OHLCV candle data for crypto assets at multiple timeframes (1m, 5m, 1h, 1d)';

-- Add column comments
comment on column public.crypto_candles.product_id is 'Coinbase product ID (e.g., BTC-USD, ETH-USD)';
comment on column public.crypto_candles.timeframe is 'Candle timeframe: 1m (1 minute), 5m (5 minutes), 1h (1 hour), 1d (1 day)';
comment on column public.crypto_candles.time is 'Start timestamp of the candle bucket (aligned to timeframe boundary)';
comment on column public.crypto_candles.open is 'Opening price for the candle';
comment on column public.crypto_candles.high is 'Highest price during the candle period';
comment on column public.crypto_candles.low is 'Lowest price during the candle period';
comment on column public.crypto_candles.close is 'Closing price for the candle';
comment on column public.crypto_candles.volume is 'Total volume (dollar volume) for the candle period';

-- =============================================================================
-- Retention Policy Function
-- =============================================================================

-- Function to prune old candles based on retention rules:
--   - 1m candles: keep for 48 hours
--   - 5m candles: keep for 14 days
--   - 1h candles: keep for 90 days
--   - 1d candles: keep for 5 years
create or replace function public.prune_crypto_candles()
returns table(deleted_count bigint, timeframe_type text, cutoff_time timestamptz) as $$
declare
  v_now timestamptz := now();
  v_deleted_1m bigint;
  v_deleted_5m bigint;
  v_deleted_1h bigint;
  v_deleted_1d bigint;
  v_cutoff_1m timestamptz;
  v_cutoff_5m timestamptz;
  v_cutoff_1h timestamptz;
  v_cutoff_1d timestamptz;
begin
  -- Calculate cutoff times
  v_cutoff_1m := v_now - interval '48 hours';
  v_cutoff_5m := v_now - interval '14 days';
  v_cutoff_1h := v_now - interval '90 days';
  v_cutoff_1d := v_now - interval '5 years';
  
  -- Delete 1m candles older than 48 hours
  delete from public.crypto_candles
  where timeframe = '1m' and time < v_cutoff_1m;
  get diagnostics v_deleted_1m = row_count;
  
  -- Delete 5m candles older than 14 days
  delete from public.crypto_candles
  where timeframe = '5m' and time < v_cutoff_5m;
  get diagnostics v_deleted_5m = row_count;
  
  -- Delete 1h candles older than 90 days
  delete from public.crypto_candles
  where timeframe = '1h' and time < v_cutoff_1h;
  get diagnostics v_deleted_1h = row_count;
  
  -- Delete 1d candles older than 5 years
  delete from public.crypto_candles
  where timeframe = '1d' and time < v_cutoff_1d;
  get diagnostics v_deleted_1d = row_count;
  
  -- Return results
  return query
  select v_deleted_1m, '1m'::text, v_cutoff_1m
  union all
  select v_deleted_5m, '5m'::text, v_cutoff_5m
  union all
  select v_deleted_1h, '1h'::text, v_cutoff_1h
  union all
  select v_deleted_1d, '1d'::text, v_cutoff_1d;
end;
$$ language plpgsql security definer;

-- Add function comment
comment on function public.prune_crypto_candles() is 
  'Deletes old crypto candles based on retention rules: 1m (48h), 5m (14d), 1h (90d), 1d (5y). Returns deletion counts per timeframe.';

-- =============================================================================
-- Scheduling the Prune Function
-- =============================================================================

-- The prune_crypto_candles() function must be scheduled externally.
-- 
-- Recommended: Schedule from the Fly engine (24/7 process) or Supabase scheduled jobs.
--   - Fly engine: Add daily call to prune_crypto_candles() in the engine code
--   - Supabase: Use Supabase Dashboard scheduled jobs feature
--
-- Alternative: Schedule via pg_cron (if enabled in your Supabase project):
--   SELECT cron.schedule(
--     'prune-crypto-candles-daily',
--     '0 2 * * *',
--     $$SELECT public.prune_crypto_candles()$$
--   );
--
-- The function is ready to be called - scheduling is handled outside this migration
-- to ensure reliability and avoid silent failures.

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- Enable RLS
alter table public.crypto_candles enable row level security;

-- Policy: Authenticated users can read candles (SELECT only)
drop policy if exists "Authenticated users can view crypto candles" on public.crypto_candles;

create policy "Authenticated users can view crypto candles"
  on public.crypto_candles
  for select
  using (auth.uid() is not null);

-- Note: Inserts/updates/deletes are intentionally not allowed via RLS
-- The market data engine uses service role key which bypasses RLS
-- This ensures only the engine can write data, preventing client-side manipulation

