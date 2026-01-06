-- Add products column to track which Plaid products are enabled for each item
-- This helps differentiate between transaction items and investment items

ALTER TABLE public.plaid_items 
ADD COLUMN IF NOT EXISTS products text[] DEFAULT '{}';

COMMENT ON COLUMN public.plaid_items.products IS 'Array of Plaid product names enabled for this item (e.g., transactions, investments)';

-- Update recurring_ready based on products for existing items
-- Only items with transactions product should potentially be ready for recurring
-- Investment-only items should never be recurring_ready
UPDATE public.plaid_items 
SET recurring_ready = false 
WHERE recurring_ready = true 
AND (products IS NULL OR NOT 'transactions' = ANY(products));
