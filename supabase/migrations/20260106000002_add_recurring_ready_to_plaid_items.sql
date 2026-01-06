-- Add recurring_ready column to plaid_items
-- This tracks whether the item has completed initial transaction sync
-- and is ready for recurring transactions detection

ALTER TABLE public.plaid_items 
ADD COLUMN IF NOT EXISTS recurring_ready boolean DEFAULT false;

-- Set existing items to ready if they have transactions
-- (they've likely already received the historical update webhook)
UPDATE public.plaid_items 
SET recurring_ready = true 
WHERE id IN (
  SELECT DISTINCT plaid_item_id 
  FROM public.transactions 
  WHERE plaid_item_id IS NOT NULL
);

COMMENT ON COLUMN public.plaid_items.recurring_ready IS 'Set to true when HISTORICAL_UPDATE or SYNC_UPDATES_AVAILABLE webhook is received, indicating the item is ready for recurring transactions detection';
