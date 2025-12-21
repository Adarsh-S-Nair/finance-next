-- Stock Market Data Table
-- Stores daily snapshots of market data for all stocks
-- This is separate from constituents list since it updates daily

create table if not exists public.stock_market_data (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  snapshot_date date not null,
  
  -- Price data
  last_price numeric(12, 4) not null,
  prev_close numeric(12, 4),
  
  -- Returns
  return_1d numeric(8, 4), -- 1-day return %
  return_5d numeric(8, 4), -- 5-day return %
  return_20d numeric(8, 4), -- 20-day return %
  
  -- Moving averages
  sma_20 numeric(12, 4),
  sma_50 numeric(12, 4),
  sma_200 numeric(12, 4),
  distance_from_sma50 numeric(8, 4), -- (price - sma50) / sma50 as %
  
  -- Volatility
  atr_14 numeric(12, 4),
  atr_pct numeric(8, 4), -- ATR as % of price
  
  -- Volume
  avg_dollar_volume_20d numeric(15, 2), -- Average dollar volume over 20 days
  volume_ratio numeric(8, 4), -- Today's volume / 20-day average
  
  -- Classification
  sector text, -- GICS sector
  industry text, -- GICS industry
  market_cap numeric(15, 2), -- Market capitalization
  
  -- Metadata
  created_at timestamptz default now(),
  
  -- One snapshot per ticker per day
  unique(ticker, snapshot_date)
);

-- Indexes for fast lookups
create index idx_stock_market_data_ticker on public.stock_market_data(ticker);
create index idx_stock_market_data_date on public.stock_market_data(snapshot_date);
create index idx_stock_market_data_ticker_date on public.stock_market_data(ticker, snapshot_date desc);

-- Enable RLS
alter table public.stock_market_data enable row level security;

-- RLS Policy: All authenticated users can read market data
create policy "Authenticated users can view stock market data"
  on public.stock_market_data for select
  using (auth.role() = 'authenticated');

-- Comments
comment on table public.stock_market_data is 'Daily snapshots of market data (prices, indicators, metrics) for all stocks';

