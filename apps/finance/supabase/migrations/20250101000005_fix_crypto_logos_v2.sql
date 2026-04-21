-- Fix crypto logo URLs to use correct Trust Wallet paths
-- Previous migration used incorrect folder names

-- =============================================================================
-- NATIVE BLOCKCHAIN COINS - Use blockchains/{chain}/info/logo.png
-- =============================================================================

-- BTC - bitcoin
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/bitcoin/info/logo.png'
WHERE UPPER(symbol) = 'BTC';

-- ETH - ethereum
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
WHERE UPPER(symbol) = 'ETH';

-- SOL - solana
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/info/logo.png'
WHERE UPPER(symbol) = 'SOL';

-- DOGE - folder is 'doge' not 'dogecoin'
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/doge/info/logo.png'
WHERE UPPER(symbol) = 'DOGE';

-- XRP - folder is 'xrp' not 'ripple'
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/xrp/info/logo.png'
WHERE UPPER(symbol) = 'XRP';

-- ADA - cardano
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/cardano/info/logo.png'
WHERE UPPER(symbol) = 'ADA';

-- DOT - polkadot
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polkadot/info/logo.png'
WHERE UPPER(symbol) = 'DOT';

-- AVAX - avalanchec
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/avalanchec/info/logo.png'
WHERE UPPER(symbol) = 'AVAX';

-- MATIC/POL - polygon
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/polygon/info/logo.png'
WHERE UPPER(symbol) IN ('MATIC', 'POL');

-- ATOM - cosmos
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/cosmos/info/logo.png'
WHERE UPPER(symbol) = 'ATOM';

-- LTC - litecoin
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/litecoin/info/logo.png'
WHERE UPPER(symbol) = 'LTC';

-- TRX - tron
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/tron/info/logo.png'
WHERE UPPER(symbol) = 'TRX';

-- =============================================================================
-- ERC-20 TOKENS - Use blockchains/ethereum/assets/{contract}/logo.png
-- =============================================================================

-- PEPE
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6982508145454Ce325dDbE47a25d4ec3d2311933/logo.png'
WHERE UPPER(symbol) = 'PEPE';

-- SHIB
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE/logo.png'
WHERE UPPER(symbol) = 'SHIB';

-- UNI
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984/logo.png'
WHERE UPPER(symbol) = 'UNI';

-- LINK
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x514910771AF9Ca656af840dff83E8264EcF986CA/logo.png'
WHERE UPPER(symbol) = 'LINK';

-- AAVE
UPDATE tickers 
SET logo = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9/logo.png'
WHERE UPPER(symbol) = 'AAVE';

-- =============================================================================
-- Log the update
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Crypto logos updated with correct Trust Wallet paths (native coins and ERC-20 tokens)';
END $$;

