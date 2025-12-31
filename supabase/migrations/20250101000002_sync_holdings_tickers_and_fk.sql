-- Migration: Sync holdings tickers to tickers table and add foreign key
-- This ensures all tickers referenced in holdings exist in the tickers table

-- Step 1: Insert missing tickers from holdings into tickers table
-- This uses a temporary table approach for crypto logo URLs

-- First, insert all unique tickers from holdings that don't exist in tickers
INSERT INTO tickers (symbol, name, sector, logo, asset_type)
SELECT DISTINCT 
  h.ticker as symbol,
  CASE 
    -- Known crypto names
    WHEN UPPER(h.ticker) = 'BTC' THEN 'Bitcoin'
    WHEN UPPER(h.ticker) = 'ETH' THEN 'Ethereum'
    WHEN UPPER(h.ticker) = 'SOL' THEN 'Solana'
    WHEN UPPER(h.ticker) = 'DOGE' THEN 'Dogecoin'
    WHEN UPPER(h.ticker) = 'XRP' THEN 'XRP'
    WHEN UPPER(h.ticker) = 'PEPE' THEN 'Pepe'
    WHEN UPPER(h.ticker) = 'ADA' THEN 'Cardano'
    WHEN UPPER(h.ticker) = 'DOT' THEN 'Polkadot'
    WHEN UPPER(h.ticker) = 'AVAX' THEN 'Avalanche'
    WHEN UPPER(h.ticker) = 'MATIC' THEN 'Polygon'
    WHEN UPPER(h.ticker) = 'LINK' THEN 'Chainlink'
    WHEN UPPER(h.ticker) = 'ATOM' THEN 'Cosmos'
    WHEN UPPER(h.ticker) = 'LTC' THEN 'Litecoin'
    WHEN UPPER(h.ticker) = 'UNI' THEN 'Uniswap'
    WHEN UPPER(h.ticker) = 'SHIB' THEN 'Shiba Inu'
    WHEN UPPER(h.ticker) LIKE 'CUR:%' THEN 'Cash - ' || REPLACE(UPPER(h.ticker), 'CUR:', '')
    WHEN UPPER(h.ticker) = 'USD' THEN 'US Dollar'
    ELSE h.ticker
  END as name,
  CASE 
    WHEN UPPER(h.ticker) IN ('BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'PEPE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'ATOM', 'LTC', 'UNI', 'SHIB', 'TRX', 'BCH', 'XLM', 'ALGO', 'VET', 'FIL', 'NEAR', 'APT', 'ARB', 'OP', 'INJ', 'SUI', 'SEI', 'TON', 'HBAR', 'ETC', 'XMR', 'ICP', 'FTM', 'EGLD', 'THETA', 'XTZ', 'EOS', 'AAVE', 'MKR', 'GRT', 'CRO', 'QNT', 'SAND', 'MANA', 'AXS', 'APE', 'LDO', 'CRV', 'SNX', 'COMP', '1INCH', 'ENS', 'BAT') THEN 'Cryptocurrency'
    WHEN UPPER(h.ticker) LIKE 'CUR:%' OR UPPER(h.ticker) = 'USD' THEN 'Cash'
    ELSE 'Unknown'
  END as sector,
  CASE 
    -- Trust Wallet logo URLs for crypto
    WHEN UPPER(h.ticker) = 'BTC' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png'
    WHEN UPPER(h.ticker) = 'ETH' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
    WHEN UPPER(h.ticker) = 'SOL' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png'
    WHEN UPPER(h.ticker) = 'DOGE' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/doge/info/logo.png'
    WHEN UPPER(h.ticker) = 'XRP' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xrp/info/logo.png'
    WHEN UPPER(h.ticker) = 'ADA' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/cardano/info/logo.png'
    WHEN UPPER(h.ticker) = 'DOT' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polkadot/info/logo.png'
    WHEN UPPER(h.ticker) = 'AVAX' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png'
    WHEN UPPER(h.ticker) = 'LTC' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/litecoin/info/logo.png'
    WHEN UPPER(h.ticker) = 'ATOM' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/cosmos/info/logo.png'
    WHEN UPPER(h.ticker) = 'PEPE' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
    WHEN UPPER(h.ticker) = 'MATIC' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png'
    WHEN UPPER(h.ticker) = 'LINK' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
    WHEN UPPER(h.ticker) = 'UNI' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
    WHEN UPPER(h.ticker) = 'SHIB' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
    ELSE NULL
  END as logo,
  CASE 
    WHEN UPPER(h.ticker) IN ('BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'PEPE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'ATOM', 'LTC', 'UNI', 'SHIB', 'TRX', 'BCH', 'XLM', 'ALGO', 'VET', 'FIL', 'NEAR', 'APT', 'ARB', 'OP', 'INJ', 'SUI', 'SEI', 'TON', 'HBAR', 'ETC', 'XMR', 'ICP', 'FTM', 'EGLD', 'THETA', 'XTZ', 'EOS', 'AAVE', 'MKR', 'GRT', 'CRO', 'QNT', 'SAND', 'MANA', 'AXS', 'APE', 'LDO', 'CRV', 'SNX', 'COMP', '1INCH', 'ENS', 'BAT') THEN 'crypto'
    WHEN UPPER(h.ticker) LIKE 'CUR:%' OR UPPER(h.ticker) = 'USD' THEN 'cash'
    ELSE 'stock'
  END as asset_type
FROM holdings h
WHERE NOT EXISTS (
  SELECT 1 FROM tickers t WHERE t.symbol = h.ticker
)
ON CONFLICT (symbol) DO NOTHING;

-- Step 2: Update existing tickers that might have wrong asset_type or missing logos
UPDATE tickers
SET 
  asset_type = 'crypto',
  sector = 'Cryptocurrency',
  logo = CASE 
    WHEN symbol = 'BTC' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png'
    WHEN symbol = 'ETH' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
    WHEN symbol = 'SOL' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png'
    WHEN symbol = 'DOGE' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/doge/info/logo.png'
    WHEN symbol = 'XRP' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xrp/info/logo.png'
    WHEN symbol = 'PEPE' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
    WHEN symbol = 'ADA' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/cardano/info/logo.png'
    WHEN symbol = 'DOT' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polkadot/info/logo.png'
    WHEN symbol = 'AVAX' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png'
    WHEN symbol = 'LTC' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/litecoin/info/logo.png'
    WHEN symbol = 'ATOM' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/cosmos/info/logo.png'
    WHEN symbol = 'MATIC' THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png'
    ELSE logo
  END
WHERE symbol IN ('BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'PEPE', 'ADA', 'DOT', 'AVAX', 'LTC', 'ATOM', 'MATIC', 'LINK', 'UNI', 'SHIB');

-- Step 3: Update cash tickers
UPDATE tickers
SET 
  asset_type = 'cash',
  sector = 'Cash'
WHERE symbol LIKE 'CUR:%' OR symbol = 'USD';

-- Step 4: Update holdings.asset_type based on tickers (if column exists)
-- This updates the denormalized asset_type on holdings to match tickers
UPDATE holdings h
SET asset_type = t.asset_type
FROM tickers t
WHERE h.ticker = t.symbol
AND h.asset_type IS DISTINCT FROM t.asset_type;

-- Step 5: Add foreign key constraint (optional - uncomment if you want referential integrity)
-- NOTE: This will fail if there are orphaned holdings with tickers not in the tickers table
-- You should run the INSERT above first to ensure all tickers exist

-- First, check if the constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'holdings_ticker_fkey' 
    AND table_name = 'holdings'
  ) THEN
    -- Add the foreign key constraint
    ALTER TABLE holdings 
    ADD CONSTRAINT holdings_ticker_fkey 
    FOREIGN KEY (ticker) REFERENCES tickers(symbol)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;
    
    RAISE NOTICE 'Foreign key constraint holdings_ticker_fkey added successfully';
  ELSE
    RAISE NOTICE 'Foreign key constraint holdings_ticker_fkey already exists';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not add foreign key constraint: %. This usually means there are holdings with tickers not in the tickers table.', SQLERRM;
END;
$$;

-- Step 6: Create an index on holdings.ticker for faster joins (if not exists)
CREATE INDEX IF NOT EXISTS idx_holdings_ticker ON holdings(ticker);

-- Verification queries (run manually to check)
-- SELECT h.ticker, t.symbol, t.asset_type, t.logo FROM holdings h LEFT JOIN tickers t ON h.ticker = t.symbol WHERE t.symbol IS NULL;
-- SELECT symbol, asset_type, logo FROM tickers WHERE asset_type = 'crypto';

