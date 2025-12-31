-- Add asset_type column to holdings table
-- This stores the type of asset (stock, crypto, cash) directly on the holding
-- for faster lookups and resilience (doesn't require tickers table lookup)

ALTER TABLE holdings 
ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'stock';

-- Update existing holdings based on tickers table where available
UPDATE holdings h
SET asset_type = t.asset_type
FROM tickers t
WHERE h.ticker = t.symbol
AND t.asset_type IS NOT NULL;

-- Update any CUR: prefixed tickers to cash (legacy format)
UPDATE holdings
SET asset_type = 'cash'
WHERE ticker LIKE 'CUR:%';

-- Update USD and other common cash tickers
UPDATE holdings
SET asset_type = 'cash'
WHERE ticker IN ('USD', 'EUR', 'GBP', 'CAD', 'JPY', 'CHF', 'AUD');

-- Add an index for efficient filtering by asset_type
CREATE INDEX IF NOT EXISTS idx_holdings_asset_type ON holdings(asset_type);

-- Add comment for documentation
COMMENT ON COLUMN holdings.asset_type IS 'Type of asset: stock, crypto, or cash';

