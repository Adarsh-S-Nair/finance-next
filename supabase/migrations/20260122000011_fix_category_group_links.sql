-- Fix: Set plaid_category_key on existing category_groups and link orphaned system_categories

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
-- STEP 2: Link orphaned system_categories to their groups using plaid_category_key prefix
-- ============================================================================

-- Update all system_categories that have null group_id but have a plaid_category_key
-- The plaid_category_key prefix tells us which group they belong to

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'INCOME_%'
  AND cg.plaid_category_key = 'INCOME';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'LOAN_DISBURSEMENTS_%'
  AND cg.plaid_category_key = 'LOAN_DISBURSEMENTS';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'LOAN_PAYMENTS_%'
  AND cg.plaid_category_key = 'LOAN_PAYMENTS';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'TRANSFER_IN_%'
  AND cg.plaid_category_key = 'TRANSFER_IN';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'TRANSFER_OUT_%'
  AND cg.plaid_category_key = 'TRANSFER_OUT';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'BANK_FEES_%'
  AND cg.plaid_category_key = 'BANK_FEES';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'ENTERTAINMENT_%'
  AND cg.plaid_category_key = 'ENTERTAINMENT';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'FOOD_AND_DRINK_%'
  AND cg.plaid_category_key = 'FOOD_AND_DRINK';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'GENERAL_MERCHANDISE_%'
  AND cg.plaid_category_key = 'GENERAL_MERCHANDISE';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'HOME_IMPROVEMENT_%'
  AND cg.plaid_category_key = 'HOME_IMPROVEMENT';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'MEDICAL_%'
  AND cg.plaid_category_key = 'MEDICAL';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'PERSONAL_CARE_%'
  AND cg.plaid_category_key = 'PERSONAL_CARE';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'GENERAL_SERVICES_%'
  AND cg.plaid_category_key = 'GENERAL_SERVICES';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'GOVERNMENT_AND_NON_PROFIT_%'
  AND cg.plaid_category_key = 'GOVERNMENT_AND_NON_PROFIT';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'TRANSPORTATION_%'
  AND cg.plaid_category_key = 'TRANSPORTATION';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'TRAVEL_%'
  AND cg.plaid_category_key = 'TRAVEL';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'RENT_AND_UTILITIES_%'
  AND cg.plaid_category_key = 'RENT_AND_UTILITIES';

UPDATE public.system_categories sc
SET group_id = cg.id
FROM public.category_groups cg
WHERE sc.group_id IS NULL
  AND sc.plaid_category_key IS NOT NULL
  AND sc.plaid_category_key LIKE 'OTHER_%'
  AND cg.plaid_category_key = 'OTHER';
