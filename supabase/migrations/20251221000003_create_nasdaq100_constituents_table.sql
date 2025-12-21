-- NASDAQ-100 Constituents Table
-- Stores the current list of NASDAQ-100 tickers with metadata
-- Can be updated via API without requiring code deployment

create table if not exists public.nasdaq100_constituents (
  id uuid primary key default gen_random_uuid(),
  ticker text not null unique,
  name text, -- Company name (optional, can be fetched later)
  sector text, -- GICS sector (optional, can be fetched later)
  industry text, -- GICS industry (optional)
  market_cap numeric(15, 2), -- Market capitalization (optional)
  weight numeric(5, 4), -- Weight in index (optional, if available)
  added_at timestamptz default now(),
  removed_at timestamptz, -- NULL = currently in index, timestamp = when removed
  updated_at timestamptz default now(),
  
  -- Ensure ticker is uppercase for consistency
  constraint ticker_uppercase check (ticker = upper(ticker))
);

-- Index for fast lookups
create index idx_nasdaq100_constituents_ticker on public.nasdaq100_constituents(ticker);
create index idx_nasdaq100_constituents_active on public.nasdaq100_constituents(removed_at) where removed_at is null;

-- Enable RLS (we'll make this readable by all authenticated users)
alter table public.nasdaq100_constituents enable row level security;

-- RLS Policy: All authenticated users can read active constituents
create policy "Authenticated users can view active NASDAQ-100 constituents"
  on public.nasdaq100_constituents for select
  using (auth.role() = 'authenticated' and removed_at is null);

-- RLS Policy: Service role can do everything (for API updates)
-- Note: Service role bypasses RLS, so this is mainly for documentation

-- Function to update the constituents list
-- This will be called by the sync API
create or replace function public.sync_nasdaq100_constituents(
  tickers text[]
)
returns void
language plpgsql
security definer
as $$
declare
  ticker text;
  existing_ticker text;
begin
  -- Mark any tickers not in the new list as removed
  update public.nasdaq100_constituents
  set removed_at = now(),
      updated_at = now()
  where removed_at is null
    and ticker != all(tickers);
  
  -- Insert new tickers or update existing ones
  foreach ticker in array tickers
  loop
    insert into public.nasdaq100_constituents (ticker, removed_at, updated_at)
    values (upper(ticker), null, now())
    on conflict (ticker) do update
    set removed_at = null, -- Reactivate if it was previously removed
        updated_at = now();
  end loop;
end;
$$;

-- Comments
comment on table public.nasdaq100_constituents is 'NASDAQ-100 index constituents, updated via automated sync';
comment on function public.sync_nasdaq100_constituents is 'Syncs the NASDAQ-100 constituents list, marking removed tickers and adding new ones';

