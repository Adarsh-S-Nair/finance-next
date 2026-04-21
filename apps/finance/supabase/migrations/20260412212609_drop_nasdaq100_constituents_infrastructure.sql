-- Drop NASDAQ-100 constituent tracking infrastructure.
--
-- These tables and the sync_nasdaq100_constituents function existed to feed
-- the now-removed AI paper-trading experiment. No runtime code reads them
-- anymore — the rest of the trading infrastructure was dropped in
-- 20260409215842_drop_trading_tables_rewire_holdings_and_snapshots.sql and
-- the remaining code-side cleanup (scripts/sync-nasdaq100.js,
-- scripts/populate-tickers.js, the NASDAQ scraping functions in marketData.js,
-- and the /api/market-data/sync-constituents route) is being removed in
-- the same commit as this migration.
--
-- The active `tickers` table is populated on demand by the Plaid holdings
-- sync pipeline via Finnhub, which is entirely independent of NASDAQ-100
-- constituent tracking.

drop function if exists public.sync_nasdaq100_constituents(text[]);
drop table if exists public.nasdaq100_constituent_history cascade;
drop table if exists public.nasdaq100_constituents cascade;
