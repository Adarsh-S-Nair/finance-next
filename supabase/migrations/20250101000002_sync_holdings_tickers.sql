-- Migration: Sync holdings tickers to tickers table
-- This ensures all tickers referenced in holdings exist in the tickers table

-- Insert missing tickers from holdings into tickers table
INSERT INTO tickers (symbol, name, sector, logo, asset_type)
SELECT DISTINCT 
  h.ticker as symbol,
  CASE 
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
    WHEN UPPER(h.ticker) LIKE 'CUR:%' THEN 'Cash - ' || REPLACE(UPPER(h.ticker), 'CUR:', '')
    WHEN UPPER(h.ticker) = 'USD' THEN 'US Dollar'
    ELSE h.ticker
  END as name,
  CASE 
    WHEN UPPER(h.ticker) IN ('BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'PEPE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'ATOM', 'LTC', 'UNI', 'SHIB') THEN 'Cryptocurrency'
    WHEN UPPER(h.ticker) LIKE 'CUR:%' OR UPPER(h.ticker) = 'USD' THEN 'Cash'
    ELSE 'Unknown'
  END as sector,
  CASE 
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
    ELSE NULL
  END as logo,
  CASE 
    WHEN UPPER(h.ticker) IN ('BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'PEPE', 'ADA', 'DOT', 'AVAX', 'MATIC', 'LINK', 'ATOM', 'LTC', 'UNI', 'SHIB') THEN 'crypto'
    WHEN UPPER(h.ticker) LIKE 'CUR:%' OR UPPER(h.ticker) = 'USD' THEN 'cash'
    ELSE 'stock'
  END as asset_type
FROM holdings h
WHERE NOT EXISTS (
  SELECT 1 FROM tickers t WHERE t.symbol = h.ticker
)
ON CONFLICT (symbol) DO NOTHING;

-- Update existing crypto tickers with logos if missing
UPDATE tickers
SET 
  asset_type = 'crypto',
  sector = 'Cryptocurrency',
  logo = CASE 
    WHEN symbol = 'BTC' AND (logo IS NULL OR logo = '') THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png'
    WHEN symbol = 'ETH' AND (logo IS NULL OR logo = '') THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
    WHEN symbol = 'SOL' AND (logo IS NULL OR logo = '') THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png'
    WHEN symbol = 'DOGE' AND (logo IS NULL OR logo = '') THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/doge/info/logo.png'
    WHEN symbol = 'XRP' AND (logo IS NULL OR logo = '') THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xrp/info/logo.png'
    WHEN symbol = 'PEPE' AND (logo IS NULL OR logo = '') THEN 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
    ELSE COALESCE(logo, '')
  END
WHERE symbol IN ('BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'PEPE', 'ADA', 'DOT', 'AVAX', 'LTC', 'ATOM', 'MATIC', 'LINK', 'UNI', 'SHIB');

-- Update cash tickers
UPDATE tickers
SET asset_type = 'cash', sector = 'Cash'
WHERE symbol LIKE 'CUR:%' OR symbol = 'USD';

