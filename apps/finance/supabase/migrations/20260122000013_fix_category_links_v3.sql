-- Fix: Set plaid keys on groups, delete duplicate orphans, link remaining orphans

-- ============================================================================
-- STEP 1: Update existing category_groups with their plaid_category_key
-- ============================================================================

UPDATE public.category_groups SET plaid_category_key = 'INCOME' WHERE LOWER(name) = 'income' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'LOAN_DISBURSEMENTS' WHERE LOWER(name) = 'loan disbursements' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'LOAN_PAYMENTS' WHERE LOWER(name) = 'loan payments' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'TRANSFER_IN' WHERE LOWER(name) = 'transfer in' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'TRANSFER_OUT' WHERE LOWER(name) = 'transfer out' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'BANK_FEES' WHERE LOWER(name) = 'bank fees' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'ENTERTAINMENT' WHERE LOWER(name) = 'entertainment' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'FOOD_AND_DRINK' WHERE LOWER(name) = 'food and drink' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'GENERAL_MERCHANDISE' WHERE LOWER(name) = 'general merchandise' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'HOME_IMPROVEMENT' WHERE LOWER(name) = 'home improvement' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'MEDICAL' WHERE LOWER(name) = 'medical' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'PERSONAL_CARE' WHERE LOWER(name) = 'personal care' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'GENERAL_SERVICES' WHERE LOWER(name) = 'general services' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'GOVERNMENT_AND_NON_PROFIT' WHERE LOWER(name) = 'government and non profit' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'TRANSPORTATION' WHERE LOWER(name) = 'transportation' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'TRAVEL' WHERE LOWER(name) = 'travel' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'RENT_AND_UTILITIES' WHERE LOWER(name) = 'rent and utilities' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'OTHER' WHERE LOWER(name) = 'other' AND plaid_category_key IS NULL;

-- ============================================================================
-- STEP 2: Delete orphaned system_categories (null group_id)
-- These are duplicates or failed inserts from previous migrations
-- ============================================================================

DELETE FROM public.system_categories WHERE group_id IS NULL;

-- ============================================================================
-- STEP 3: Link remaining orphaned categories (if any exist somehow)
-- ============================================================================

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE CONCAT(cg.plaid_category_key, '_%');
