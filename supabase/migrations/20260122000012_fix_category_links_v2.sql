-- Fix: Delete orphaned duplicate categories and link remaining orphans to groups

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
-- STEP 2: Delete orphaned system_categories that would conflict
-- (where another row with same label already exists with a group_id)
-- ============================================================================

DELETE FROM public.system_categories orphan
WHERE orphan.group_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.system_categories existing
    WHERE existing.label = orphan.label
      AND existing.group_id IS NOT NULL
  );

-- ============================================================================
-- STEP 3: Update existing (non-orphaned) system_categories with plaid_category_key
-- ============================================================================

-- Set plaid_category_key on categories that have group_id but no plaid key
UPDATE public.system_categories sc
SET plaid_category_key = CONCAT(cg.plaid_category_key, '_', UPPER(REPLACE(sc.label, ' ', '_')))
FROM public.category_groups cg
WHERE sc.group_id = cg.id
  AND sc.plaid_category_key IS NULL
  AND cg.plaid_category_key IS NOT NULL;

-- ============================================================================
-- STEP 4: Link remaining orphaned categories (ones without conflicts)
-- ============================================================================

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE CONCAT(cg.plaid_category_key, '_%');
