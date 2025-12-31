-- Ensure common crypto tickers have asset_type = 'crypto'
-- This fixes any tickers that may have been incorrectly set as 'stock'

UPDATE tickers 
SET asset_type = 'crypto'
WHERE UPPER(symbol) IN (
  'BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'DOT', 'AVAX', 'MATIC', 'POL',
  'ATOM', 'LTC', 'TRX', 'BCH', 'XLM', 'ALGO', 'VET', 'FIL', 'NEAR', 'APT',
  'ARB', 'OP', 'INJ', 'SUI', 'SEI', 'TON', 'HBAR', 'ETC', 'XMR', 'ICP',
  'FTM', 'EGLD', 'THETA', 'XTZ', 'EOS', 'CRO', 'PEPE', 'SHIB', 'UNI', 'LINK',
  'AAVE', 'MKR', 'GRT', 'SAND', 'MANA', 'AXS', 'APE', 'LDO', 'CRV', 'SNX',
  'COMP', '1INCH', 'ENS', 'BAT', 'USDT', 'USDC', 'DAI', 'WBTC', 'WETH',
  'BNB', 'LEO', 'OKB', 'FDUSD', 'RENDER', 'TAO', 'KAS', 'IMX'
)
AND asset_type != 'crypto';

-- Also update holdings table asset_type to match
UPDATE holdings h
SET asset_type = 'crypto'
FROM tickers t
WHERE h.ticker = t.symbol
AND t.asset_type = 'crypto'
AND h.asset_type != 'crypto';

DO $$
BEGIN
  RAISE NOTICE 'Crypto asset types verified and corrected';
END $$;

