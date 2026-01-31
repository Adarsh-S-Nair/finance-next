-- =============================================================================
-- Add arbitrage price history table for terminal feed
-- Stores historical price data from multiple exchanges
-- =============================================================================

-- Create arbitrage_price_history table
create table if not exists public.arbitrage_price_history (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid references public.portfolios(id) on delete cascade not null,
  crypto text not null,
  exchange text not null,
  price numeric(16, 4) not null,
  volume_24h numeric(20, 2),
  is_lowest boolean default false,
  is_highest boolean default false,
  spread_percent numeric(8, 4),
  created_at timestamptz default now() not null
);

-- Create index for efficient queries
create index if not exists idx_arbitrage_price_history_portfolio_created
  on public.arbitrage_price_history(portfolio_id, created_at desc);

-- Create index for cleanup of old records
create index if not exists idx_arbitrage_price_history_created_at
  on public.arbitrage_price_history(created_at);

-- Enable RLS
alter table public.arbitrage_price_history enable row level security;

-- RLS policy: users can read their own portfolio's price history
create policy "Users can view their portfolio price history"
  on public.arbitrage_price_history for select
  using (
    portfolio_id in (
      select id from public.portfolios where user_id = auth.uid()
    )
  );

-- RLS policy: service role can insert (for the engine)
create policy "Service role can insert price history"
  on public.arbitrage_price_history for insert
  with check (true);

-- Enable realtime for this table
alter publication supabase_realtime add table public.arbitrage_price_history;

-- Function to clean up old price history (keep last 24 hours)
create or replace function public.cleanup_old_arbitrage_prices()
returns void as $$
begin
  delete from public.arbitrage_price_history
  where created_at < now() - interval '24 hours';
end;
$$ language plpgsql security definer;
