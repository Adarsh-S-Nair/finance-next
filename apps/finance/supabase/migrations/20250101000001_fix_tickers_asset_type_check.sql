-- Fix the tickers asset_type check constraint to include 'cash'
-- The existing constraint only allows 'stock' and 'crypto'

-- Step 1: Drop the existing constraint
ALTER TABLE tickers DROP CONSTRAINT IF EXISTS tickers_asset_type_check;

-- Step 2: Add the updated constraint with 'cash' included
ALTER TABLE tickers ADD CONSTRAINT tickers_asset_type_check 
  CHECK (asset_type IN ('stock', 'crypto', 'cash'));

-- Verify the constraint was updated
DO $$
BEGIN
  RAISE NOTICE 'tickers_asset_type_check constraint updated to allow: stock, crypto, cash';
END;
$$;

