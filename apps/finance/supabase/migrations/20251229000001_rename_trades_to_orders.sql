-- =============================================================================
-- Rename trades table to orders
-- The table actually represents orders (buy/sell orders), not executed trades
-- =============================================================================

-- Drop old RLS policies (drop before renaming table)
drop policy if exists "Users can view trades of their portfolios" on public.trades;
drop policy if exists "Users can insert trades to their portfolios" on public.trades;
drop policy if exists "Users can update trades in their portfolios" on public.trades;
drop policy if exists "Users can delete trades from their portfolios" on public.trades;

-- Drop old indexes (drop before renaming table)
drop index if exists public.idx_trades_portfolio_id;
drop index if exists public.idx_trades_executed_at;
drop index if exists public.idx_trades_ticker;
drop index if exists public.idx_trades_is_pending;
drop index if exists public.idx_trades_portfolio_pending;
drop index if exists public.idx_trades_portfolio_executed_at;
drop index if exists public.idx_trades_portfolio_executed_at_not_pending;

-- Rename the table
alter table public.trades rename to orders;

-- Create new RLS policies with updated names
create policy "Users can view orders of their portfolios"
  on public.orders for select
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = orders.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can insert orders to their portfolios"
  on public.orders for insert
  with check (
    exists (
      select 1 from public.portfolios p
      where p.id = orders.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can update orders in their portfolios"
  on public.orders for update
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = orders.portfolio_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can delete orders from their portfolios"
  on public.orders for delete
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = orders.portfolio_id
      and p.user_id = auth.uid()
    )
  );

-- Create new indexes with updated names
create index idx_orders_portfolio_id on public.orders(portfolio_id);
create index idx_orders_executed_at on public.orders(executed_at);
create index idx_orders_ticker on public.orders(ticker);
create index idx_orders_is_pending on public.orders(is_pending) where is_pending = true;
create index idx_orders_portfolio_pending on public.orders(portfolio_id, is_pending) where is_pending = true;
create index idx_orders_portfolio_executed_at on public.orders(portfolio_id, executed_at);
create index idx_orders_portfolio_executed_at_not_pending on public.orders(portfolio_id, executed_at)
  where executed_at is not null and is_pending = false;

-- Update table comment
comment on table public.orders is 'Unified orders table for all portfolio types. Represents buy/sell orders (previously trades).';
comment on column public.orders.reasoning is 'AI reasoning for order (only for ai_simulation portfolios)';
comment on column public.orders.source is 'Source of the order: engine, manual, or other';
comment on column public.orders.meta is 'Additional metadata as JSONB (e.g., exit_reason, stop_loss_price, etc.)';

