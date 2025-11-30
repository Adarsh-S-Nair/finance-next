-- Add date and authorized_date columns to transactions table
-- These columns store the calendar date of the transaction, independent of timezones

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS date date,
ADD COLUMN IF NOT EXISTS authorized_date date;

-- Backfill date column from existing datetime column
-- We cast datetime (timestamptz) to date, which uses the timezone of the server (usually UTC)
-- Since we know existing data was stored as UTC midnight for dates, this is correct.
UPDATE public.transactions
SET date = datetime::date
WHERE date IS NULL AND datetime IS NOT NULL;

-- Make date column not null after backfill (optional, but good practice if we want to enforce it)
-- We'll leave it nullable for now to be safe, or we can enforce it if we are sure.
-- Let's keep it nullable to avoid issues if there are rows with null datetime (though there shouldn't be).

-- Add index on date column for querying
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions (date);
CREATE INDEX IF NOT EXISTS idx_transactions_authorized_date ON public.transactions (authorized_date);

-- Comment on columns
COMMENT ON COLUMN public.transactions.date IS 'Transaction posting date (calendar date)';
COMMENT ON COLUMN public.transactions.authorized_date IS 'Transaction authorization date (calendar date)';
