-- Add is_unmatched_transfer column to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS is_unmatched_transfer BOOLEAN DEFAULT FALSE;

-- Add index for performance (optional but good for filtering)
CREATE INDEX IF NOT EXISTS idx_transactions_is_unmatched_transfer ON transactions(is_unmatched_transfer);
