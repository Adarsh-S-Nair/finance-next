-- Fix crypto logo URLs to use correct Trust Wallet blockchain names
-- The previous logos used ticker symbols (e.g., 'xrp') instead of blockchain names (e.g., 'ripple')

-- Update XRP logo (ripple, not xrp)
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ripple/info/logo.png'
WHERE UPPER(symbol) = 'XRP' 
  AND (logo IS NULL OR logo LIKE '%/xrp/%');

-- Update DOGE logo (dogecoin, not doge)
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/dogecoin/info/logo.png'
WHERE UPPER(symbol) = 'DOGE' 
  AND (logo IS NULL OR logo LIKE '%/doge/%');

-- Update ICP logo (internetcomputer, not internet-computer)
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/internetcomputer/info/logo.png'
WHERE UPPER(symbol) = 'ICP' 
  AND (logo IS NULL OR logo LIKE '%/internet-computer/%');

-- Ensure BTC has correct logo
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png'
WHERE UPPER(symbol) = 'BTC' 
  AND (logo IS NULL OR logo NOT LIKE '%/bitcoin/%');

-- Ensure ETH has correct logo
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
WHERE UPPER(symbol) = 'ETH' 
  AND (logo IS NULL OR logo NOT LIKE '%/ethereum/%');

-- Ensure SOL has correct logo
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png'
WHERE UPPER(symbol) = 'SOL' 
  AND (logo IS NULL OR logo NOT LIKE '%/solana/%');

-- Log the update
DO $$
BEGIN
  RAISE NOTICE 'Crypto logo URLs updated to use correct Trust Wallet blockchain names';
END $$;

