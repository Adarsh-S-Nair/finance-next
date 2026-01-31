-- Create arbitrage_opportunities table to store detected opportunities
CREATE TABLE IF NOT EXISTS public.arbitrage_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  crypto TEXT NOT NULL,
  buy_exchange TEXT NOT NULL,
  sell_exchange TEXT NOT NULL,
  buy_price DECIMAL(20, 8) NOT NULL,
  sell_price DECIMAL(20, 8) NOT NULL,
  amount DECIMAL(20, 8) NOT NULL,
  gross_profit DECIMAL(20, 8) NOT NULL,
  fees DECIMAL(20, 8) NOT NULL DEFAULT 0,
  profit DECIMAL(20, 8) NOT NULL,
  profit_percent DECIMAL(10, 4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'executed', 'missed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  executed_at TIMESTAMPTZ,
  metadata JSONB
);

-- Index for fetching opportunities by portfolio
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_portfolio
  ON public.arbitrage_opportunities(portfolio_id, created_at DESC);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_status
  ON public.arbitrage_opportunities(status, created_at DESC);

-- Enable RLS
ALTER TABLE public.arbitrage_opportunities ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own opportunities (via portfolio ownership)
CREATE POLICY "Users can view their own arbitrage opportunities" ON public.arbitrage_opportunities
  FOR SELECT
  USING (
    portfolio_id IN (
      SELECT id FROM public.portfolios WHERE user_id = auth.uid()
    )
  );

-- Allow service role to insert/update (for the engine)
CREATE POLICY "Service role can manage arbitrage opportunities" ON public.arbitrage_opportunities
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for the opportunities table
ALTER PUBLICATION supabase_realtime ADD TABLE public.arbitrage_opportunities;
