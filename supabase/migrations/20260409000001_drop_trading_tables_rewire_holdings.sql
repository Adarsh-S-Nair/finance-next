-- =============================================================================
-- Remove paper trading / AI / arbitrage / Alpaca infrastructure.
-- Rewire `holdings` to reference `accounts` directly (single source of truth)
-- and improve `account_snapshots` so it can serve as the net-worth history
-- for every account type, including investments.
-- =============================================================================

-- 1. Rewire `holdings` from portfolios → accounts ----------------------------
DROP POLICY IF EXISTS "Users can view holdings of their portfolios" ON public.holdings;
DROP POLICY IF EXISTS "Users can insert holdings to their portfolios" ON public.holdings;
DROP POLICY IF EXISTS "Users can update holdings in their portfolios" ON public.holdings;
DROP POLICY IF EXISTS "Users can delete holdings from their portfolios" ON public.holdings;

ALTER TABLE public.holdings
  ADD COLUMN account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.holdings
  DROP COLUMN portfolio_id;

ALTER TABLE public.holdings
  ALTER COLUMN account_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_holdings_account_id ON public.holdings(account_id);

-- New RLS policies keyed on the owning account
CREATE POLICY "Users can view their own holdings" ON public.holdings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = holdings.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can insert their own holdings" ON public.holdings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = holdings.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can update their own holdings" ON public.holdings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = holdings.account_id AND accounts.user_id = auth.uid())
  );

CREATE POLICY "Users can delete their own holdings" ON public.holdings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.accounts WHERE accounts.id = holdings.account_id AND accounts.user_id = auth.uid())
  );

-- 2. Improve `account_snapshots` -----------------------------------------------
--    a. Tag each snapshot with the account type so queries can filter without joining
ALTER TABLE public.account_snapshots
  ADD COLUMN IF NOT EXISTS account_type text;

UPDATE public.account_snapshots AS s
   SET account_type = a.type
  FROM public.accounts AS a
 WHERE a.id = s.account_id
   AND s.account_type IS NULL;

--    b. Dedupe existing snapshots at (account_id, UTC day) granularity
DELETE FROM public.account_snapshots s
 USING public.account_snapshots s2
 WHERE s.account_id = s2.account_id
   AND ((s.recorded_at AT TIME ZONE 'UTC')::date) = ((s2.recorded_at AT TIME ZONE 'UTC')::date)
   AND (s.recorded_at < s2.recorded_at
        OR (s.recorded_at = s2.recorded_at AND s.id < s2.id));

--    c. Enforce one snapshot per account per UTC day going forward
CREATE UNIQUE INDEX IF NOT EXISTS account_snapshots_account_day_uniq
  ON public.account_snapshots (account_id, ((recorded_at AT TIME ZONE 'UTC')::date));

-- 3. Drop doomed tables --------------------------------------------------------
DROP TABLE IF EXISTS public.trades CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;
DROP TABLE IF EXISTS public.arbitrage_opportunities CASCADE;
DROP TABLE IF EXISTS public.arbitrage_price_history CASCADE;
DROP TABLE IF EXISTS public.arbitrage_trades CASCADE;
DROP TABLE IF EXISTS public.exchange_balances CASCADE;
DROP TABLE IF EXISTS public.portfolio_snapshots CASCADE;
DROP TABLE IF EXISTS public.portfolios CASCADE;
DROP TABLE IF EXISTS public.crypto_candles CASCADE;
