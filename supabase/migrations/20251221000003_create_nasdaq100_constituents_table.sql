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

-- Function to update the constituents list with audit trail
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
  was_removed boolean;
  was_active boolean;
  current_date date := current_date;
begin
  -- Mark any tickers not in the new list as removed
  -- And record in history
  for ticker in 
    select t.ticker 
    from public.nasdaq100_constituents t
    where t.removed_at is null
      and t.ticker != all(tickers)
  loop
    -- Mark as removed
    update public.nasdaq100_constituents
    set removed_at = now(),
        updated_at = now()
    where nasdaq100_constituents.ticker = ticker;
    
    -- Record in history
    insert into public.nasdaq100_constituent_history (ticker, action, effective_date)
    values (ticker, 'removed', current_date);
  end loop;
  
  -- Insert new tickers or reactivate existing ones
  foreach ticker in array tickers
  loop
    ticker := upper(ticker);
    
    -- Check current status
    select 
      removed_at is null,
      removed_at is not null
    into was_active, was_removed
    from public.nasdaq100_constituents
    where nasdaq100_constituents.ticker = ticker;
    
    -- Insert or update
    insert into public.nasdaq100_constituents (ticker, removed_at, updated_at)
    values (ticker, null, now())
    on conflict (ticker) do update
    set removed_at = null, -- Reactivate if it was previously removed
        updated_at = now();
    
    -- Record in history if it's a new addition or re-addition
    if was_removed or was_active is null then
      insert into public.nasdaq100_constituent_history (ticker, action, effective_date)
      values (ticker, 'added', current_date);
    end if;
  end loop;
end;
$$;

-- Comments
comment on table public.nasdaq100_constituents is 'NASDAQ-100 index constituents, updated via automated sync';
comment on function public.sync_nasdaq100_constituents is 'Syncs the NASDAQ-100 constituents list, marking removed tickers and adding new ones';

