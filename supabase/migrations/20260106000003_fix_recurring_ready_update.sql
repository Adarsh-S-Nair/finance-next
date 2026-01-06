-- Fix for 20260106000002: Set existing items with transactions to recurring_ready = true
-- The original migration used wrong column name, this fixes it by joining through accounts

UPDATE public.plaid_items 
SET recurring_ready = true 
WHERE id IN (
  SELECT DISTINCT a.plaid_item_id 
  FROM public.accounts a
  INNER JOIN public.transactions t ON t.account_id = a.id
  WHERE a.plaid_item_id IS NOT NULL
);
