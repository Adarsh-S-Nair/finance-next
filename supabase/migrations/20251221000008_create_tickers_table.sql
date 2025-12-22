-- Tickers Table
-- Stores ticker symbol information for stocks
-- This is a general tickers table that can be populated with data from various sources

create table if not exists public.tickers (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  name text, -- Company name
  sector text, -- GICS sector classification
  logo text, -- URL to company logo
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure symbol is uppercase for consistency
  constraint symbol_uppercase check (symbol = upper(symbol))
);

-- Index for fast lookups
create index idx_tickers_symbol on public.tickers(symbol);
create index idx_tickers_sector on public.tickers(sector);

-- Enable RLS
alter table public.tickers enable row level security;

-- RLS Policy: All authenticated users can read tickers
create policy "Authenticated users can view tickers"
  on public.tickers for select
  using (auth.role() = 'authenticated');

-- RLS Policy: Service role can do everything (for API updates)
-- Note: Service role bypasses RLS, so this is mainly for documentation

-- Comments
comment on table public.tickers is 'General ticker symbol information table for stocks';
comment on column public.tickers.symbol is 'Stock ticker symbol (uppercase, unique)';
comment on column public.tickers.name is 'Company name';
comment on column public.tickers.sector is 'GICS sector classification';
comment on column public.tickers.logo is 'URL to company logo image';

