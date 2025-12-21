-- Fix sync_nasdaq100_constituents function
-- Resolves ambiguous column reference errors
-- This migration updates the function to use proper table aliases

create or replace function public.sync_nasdaq100_constituents(
  tickers text[]
)
returns void
language plpgsql
security definer
as $$
declare
  ticker_val text;
  was_removed boolean;
  was_active boolean;
  current_date_val date := current_date;
begin
  -- Mark any tickers not in the new list as removed
  -- And record in history
  for ticker_val in 
    select t.ticker 
    from public.nasdaq100_constituents t
    where t.removed_at is null
      and t.ticker != all(tickers)
  loop
    -- Mark as removed
    update public.nasdaq100_constituents
    set removed_at = now(),
        updated_at = now()
    where nasdaq100_constituents.ticker = ticker_val;
    
    -- Record in history
    insert into public.nasdaq100_constituent_history (ticker, action, effective_date)
    values (ticker_val, 'removed', current_date_val);
  end loop;
  
  -- Insert new tickers or reactivate existing ones
  foreach ticker_val in array tickers
  loop
    ticker_val := upper(ticker_val);
    
    -- Check current status (use table alias to avoid ambiguity)
    select 
      c.removed_at is null,
      c.removed_at is not null
    into was_active, was_removed
    from public.nasdaq100_constituents c
    where c.ticker = ticker_val;
    
    -- Insert or update
    insert into public.nasdaq100_constituents (ticker, removed_at, updated_at)
    values (ticker_val, null, now())
    on conflict (ticker) do update
    set removed_at = null, -- Reactivate if it was previously removed
        updated_at = now();
    
    -- Record in history if it's a new addition or re-addition
    if was_removed or was_active is null then
      insert into public.nasdaq100_constituent_history (ticker, action, effective_date)
      values (ticker_val, 'added', current_date_val);
    end if;
  end loop;
end;
$$;

-- Comments
comment on function public.sync_nasdaq100_constituents is 'Syncs the NASDAQ-100 constituents list, marking removed tickers and adding new ones. Fixed to resolve ambiguous column references.';

