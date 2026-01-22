-- Seed all Plaid Personal Finance Categories (PFCv2)
-- This migration is fully idempotent and handles all edge cases:
-- 1. Existing categories without plaid_category_key (dynamically created)
-- 2. Partial data from previous failed migration runs
-- 3. All unique constraint combinations

-- ============================================================================
-- STEP 1: Update existing category_groups with plaid_category_key and icon_url
-- Only update if the plaid_category_key is not already used by another row
-- ============================================================================

UPDATE public.category_groups SET plaid_category_key = 'INCOME', icon_url = 'https://plaid-category-icons.plaid.com/PFC_INCOME.png' 
WHERE LOWER(name) = 'income' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'INCOME');

UPDATE public.category_groups SET plaid_category_key = 'LOAN_DISBURSEMENTS', icon_url = 'https://plaid-category-icons.plaid.com/PFC_LOAN_DISBURSEMENTS.png' 
WHERE LOWER(name) = 'loan disbursements' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'LOAN_DISBURSEMENTS');

UPDATE public.category_groups SET plaid_category_key = 'LOAN_PAYMENTS', icon_url = 'https://plaid-category-icons.plaid.com/PFC_LOAN_PAYMENTS.png' 
WHERE LOWER(name) = 'loan payments' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'LOAN_PAYMENTS');

UPDATE public.category_groups SET plaid_category_key = 'TRANSFER_IN', icon_url = 'https://plaid-category-icons.plaid.com/PFC_TRANSFER_IN.png' 
WHERE LOWER(name) = 'transfer in' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'TRANSFER_IN');

UPDATE public.category_groups SET plaid_category_key = 'TRANSFER_OUT', icon_url = 'https://plaid-category-icons.plaid.com/PFC_TRANSFER_OUT.png' 
WHERE LOWER(name) = 'transfer out' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'TRANSFER_OUT');

UPDATE public.category_groups SET plaid_category_key = 'BANK_FEES', icon_url = 'https://plaid-category-icons.plaid.com/PFC_BANK_FEES.png' 
WHERE LOWER(name) = 'bank fees' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'BANK_FEES');

UPDATE public.category_groups SET plaid_category_key = 'ENTERTAINMENT', icon_url = 'https://plaid-category-icons.plaid.com/PFC_ENTERTAINMENT.png' 
WHERE LOWER(name) = 'entertainment' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'ENTERTAINMENT');

UPDATE public.category_groups SET plaid_category_key = 'FOOD_AND_DRINK', icon_url = 'https://plaid-category-icons.plaid.com/PFC_FOOD_AND_DRINK.png' 
WHERE LOWER(name) = 'food and drink' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'FOOD_AND_DRINK');

UPDATE public.category_groups SET plaid_category_key = 'GENERAL_MERCHANDISE', icon_url = 'https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png' 
WHERE LOWER(name) = 'general merchandise' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'GENERAL_MERCHANDISE');

UPDATE public.category_groups SET plaid_category_key = 'HOME_IMPROVEMENT', icon_url = 'https://plaid-category-icons.plaid.com/PFC_HOME_IMPROVEMENT.png' 
WHERE LOWER(name) = 'home improvement' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'HOME_IMPROVEMENT');

UPDATE public.category_groups SET plaid_category_key = 'MEDICAL', icon_url = 'https://plaid-category-icons.plaid.com/PFC_MEDICAL.png' 
WHERE LOWER(name) = 'medical' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'MEDICAL');

UPDATE public.category_groups SET plaid_category_key = 'PERSONAL_CARE', icon_url = 'https://plaid-category-icons.plaid.com/PFC_PERSONAL_CARE.png' 
WHERE LOWER(name) = 'personal care' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'PERSONAL_CARE');

UPDATE public.category_groups SET plaid_category_key = 'GENERAL_SERVICES', icon_url = 'https://plaid-category-icons.plaid.com/PFC_GENERAL_SERVICES.png' 
WHERE LOWER(name) = 'general services' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'GENERAL_SERVICES');

UPDATE public.category_groups SET plaid_category_key = 'GOVERNMENT_AND_NON_PROFIT', icon_url = 'https://plaid-category-icons.plaid.com/PFC_GOVERNMENT_AND_NON_PROFIT.png' 
WHERE LOWER(name) = 'government and non profit' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'GOVERNMENT_AND_NON_PROFIT');

UPDATE public.category_groups SET plaid_category_key = 'TRANSPORTATION', icon_url = 'https://plaid-category-icons.plaid.com/PFC_TRANSPORTATION.png' 
WHERE LOWER(name) = 'transportation' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'TRANSPORTATION');

UPDATE public.category_groups SET plaid_category_key = 'TRAVEL', icon_url = 'https://plaid-category-icons.plaid.com/PFC_TRAVEL.png' 
WHERE LOWER(name) = 'travel' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'TRAVEL');

UPDATE public.category_groups SET plaid_category_key = 'RENT_AND_UTILITIES', icon_url = 'https://plaid-category-icons.plaid.com/PFC_RENT_AND_UTILITIES.png' 
WHERE LOWER(name) = 'rent and utilities' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'RENT_AND_UTILITIES');

UPDATE public.category_groups SET plaid_category_key = 'OTHER', icon_url = 'https://plaid-category-icons.plaid.com/PFC_OTHER.png' 
WHERE LOWER(name) = 'other' AND plaid_category_key IS NULL 
AND NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = 'OTHER');

-- ============================================================================
-- STEP 2: Insert only category_groups that don't exist yet
-- ============================================================================

INSERT INTO public.category_groups (name, plaid_category_key, icon_url, hex_color)
SELECT * FROM (VALUES
  ('Income', 'INCOME', 'https://plaid-category-icons.plaid.com/PFC_INCOME.png', '#10B981'),
  ('Loan Disbursements', 'LOAN_DISBURSEMENTS', 'https://plaid-category-icons.plaid.com/PFC_LOAN_DISBURSEMENTS.png', '#6366F1'),
  ('Loan Payments', 'LOAN_PAYMENTS', 'https://plaid-category-icons.plaid.com/PFC_LOAN_PAYMENTS.png', '#EF4444'),
  ('Transfer In', 'TRANSFER_IN', 'https://plaid-category-icons.plaid.com/PFC_TRANSFER_IN.png', '#14B8A6'),
  ('Transfer Out', 'TRANSFER_OUT', 'https://plaid-category-icons.plaid.com/PFC_TRANSFER_OUT.png', '#F97316'),
  ('Bank Fees', 'BANK_FEES', 'https://plaid-category-icons.plaid.com/PFC_BANK_FEES.png', '#DC2626'),
  ('Entertainment', 'ENTERTAINMENT', 'https://plaid-category-icons.plaid.com/PFC_ENTERTAINMENT.png', '#A855F7'),
  ('Food and Drink', 'FOOD_AND_DRINK', 'https://plaid-category-icons.plaid.com/PFC_FOOD_AND_DRINK.png', '#F59E0B'),
  ('General Merchandise', 'GENERAL_MERCHANDISE', 'https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png', '#3B82F6'),
  ('Home Improvement', 'HOME_IMPROVEMENT', 'https://plaid-category-icons.plaid.com/PFC_HOME_IMPROVEMENT.png', '#84CC16'),
  ('Medical', 'MEDICAL', 'https://plaid-category-icons.plaid.com/PFC_MEDICAL.png', '#EC4899'),
  ('Personal Care', 'PERSONAL_CARE', 'https://plaid-category-icons.plaid.com/PFC_PERSONAL_CARE.png', '#8B5CF6'),
  ('General Services', 'GENERAL_SERVICES', 'https://plaid-category-icons.plaid.com/PFC_GENERAL_SERVICES.png', '#06B6D4'),
  ('Government and Non Profit', 'GOVERNMENT_AND_NON_PROFIT', 'https://plaid-category-icons.plaid.com/PFC_GOVERNMENT_AND_NON_PROFIT.png', '#059669'),
  ('Transportation', 'TRANSPORTATION', 'https://plaid-category-icons.plaid.com/PFC_TRANSPORTATION.png', '#0D9488'),
  ('Travel', 'TRAVEL', 'https://plaid-category-icons.plaid.com/PFC_TRAVEL.png', '#7C3AED'),
  ('Rent and Utilities', 'RENT_AND_UTILITIES', 'https://plaid-category-icons.plaid.com/PFC_RENT_AND_UTILITIES.png', '#D97706'),
  ('Other', 'OTHER', 'https://plaid-category-icons.plaid.com/PFC_OTHER.png', '#6B7280')
) AS v(name, plaid_category_key, icon_url, hex_color)
WHERE NOT EXISTS (SELECT 1 FROM public.category_groups WHERE plaid_category_key = v.plaid_category_key);

-- ============================================================================
-- STEP 3: Helper function to get category group ID by plaid key
-- ============================================================================

CREATE OR REPLACE FUNCTION get_category_group_id(p_key VARCHAR) RETURNS UUID AS $$
  SELECT id FROM public.category_groups WHERE plaid_category_key = p_key LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- ============================================================================
-- STEP 4: Update existing system_categories with plaid_category_key
-- This sets the plaid_category_key on rows that were created dynamically (without it)
-- Only update if no row already has that plaid_category_key
-- ============================================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (VALUES
    ('interest earned', 'INCOME_INTEREST_EARNED'),
    ('dividends', 'INCOME_DIVIDENDS'),
    ('retirement pension', 'INCOME_RETIREMENT_PENSION'),
    ('salary', 'INCOME_SALARY'),
    ('wages', 'INCOME_SALARY'),
    ('tax refund', 'INCOME_TAX_REFUND'),
    ('unemployment', 'INCOME_UNEMPLOYMENT'),
    ('other income', 'INCOME_OTHER'),
    ('car payment', 'LOAN_PAYMENTS_CAR_PAYMENT'),
    ('credit card payment', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'),
    ('mortgage payment', 'LOAN_PAYMENTS_MORTGAGE_PAYMENT'),
    ('personal loan payment', 'LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT'),
    ('student loan payment', 'LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT'),
    ('other payment', 'LOAN_PAYMENTS_OTHER_PAYMENT'),
    ('account transfer', 'TRANSFER_IN_ACCOUNT_TRANSFER'),
    ('deposit', 'TRANSFER_IN_DEPOSIT'),
    ('investment and retirement funds', 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS'),
    ('savings', 'TRANSFER_IN_SAVINGS'),
    ('other transfer in', 'TRANSFER_IN_OTHER_TRANSFER_IN'),
    ('withdrawal', 'TRANSFER_OUT_WITHDRAWAL'),
    ('other transfer out', 'TRANSFER_OUT_OTHER_TRANSFER_OUT'),
    ('atm fees', 'BANK_FEES_ATM_FEES'),
    ('insufficient funds', 'BANK_FEES_INSUFFICIENT_FUNDS'),
    ('interest charge', 'BANK_FEES_INTEREST_CHARGE'),
    ('foreign transaction fees', 'BANK_FEES_FOREIGN_TRANSACTION_FEES'),
    ('overdraft fees', 'BANK_FEES_OVERDRAFT_FEES'),
    ('other bank fees', 'BANK_FEES_OTHER_BANK_FEES'),
    ('casinos and gambling', 'ENTERTAINMENT_CASINOS_AND_GAMBLING'),
    ('music and audio', 'ENTERTAINMENT_MUSIC_AND_AUDIO'),
    ('sporting events amusement parks and museums', 'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS'),
    ('tv and movies', 'ENTERTAINMENT_TV_AND_MOVIES'),
    ('video games', 'ENTERTAINMENT_VIDEO_GAMES'),
    ('other entertainment', 'ENTERTAINMENT_OTHER_ENTERTAINMENT'),
    ('beer wine and liquor', 'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR'),
    ('coffee', 'FOOD_AND_DRINK_COFFEE'),
    ('fast food', 'FOOD_AND_DRINK_FAST_FOOD'),
    ('groceries', 'FOOD_AND_DRINK_GROCERIES'),
    ('restaurant', 'FOOD_AND_DRINK_RESTAURANT'),
    ('vending machines', 'FOOD_AND_DRINK_VENDING_MACHINES'),
    ('other food and drink', 'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK'),
    ('bookstores and newsstands', 'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS'),
    ('clothing and accessories', 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES'),
    ('convenience stores', 'GENERAL_MERCHANDISE_CONVENIENCE_STORES'),
    ('department stores', 'GENERAL_MERCHANDISE_DEPARTMENT_STORES'),
    ('discount stores', 'GENERAL_MERCHANDISE_DISCOUNT_STORES'),
    ('electronics', 'GENERAL_MERCHANDISE_ELECTRONICS'),
    ('gifts and novelties', 'GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES'),
    ('office supplies', 'GENERAL_MERCHANDISE_OFFICE_SUPPLIES'),
    ('online marketplaces', 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES'),
    ('pet supplies', 'GENERAL_MERCHANDISE_PET_SUPPLIES'),
    ('sporting goods', 'GENERAL_MERCHANDISE_SPORTING_GOODS'),
    ('superstores', 'GENERAL_MERCHANDISE_SUPERSTORES'),
    ('tobacco and vape', 'GENERAL_MERCHANDISE_TOBACCO_AND_VAPE'),
    ('other general merchandise', 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE'),
    ('furniture', 'HOME_IMPROVEMENT_FURNITURE'),
    ('hardware', 'HOME_IMPROVEMENT_HARDWARE'),
    ('repair and maintenance', 'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE'),
    ('security', 'HOME_IMPROVEMENT_SECURITY'),
    ('other home improvement', 'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT'),
    ('dental care', 'MEDICAL_DENTAL_CARE'),
    ('eye care', 'MEDICAL_EYE_CARE'),
    ('nursing care', 'MEDICAL_NURSING_CARE'),
    ('pharmacies and supplements', 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS'),
    ('primary care', 'MEDICAL_PRIMARY_CARE'),
    ('veterinary services', 'MEDICAL_VETERINARY_SERVICES'),
    ('other medical', 'MEDICAL_OTHER_MEDICAL'),
    ('gyms and fitness centers', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS'),
    ('hair and beauty', 'PERSONAL_CARE_HAIR_AND_BEAUTY'),
    ('laundry and dry cleaning', 'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING'),
    ('other personal care', 'PERSONAL_CARE_OTHER_PERSONAL_CARE'),
    ('accounting and financial planning', 'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING'),
    ('automotive', 'GENERAL_SERVICES_AUTOMOTIVE'),
    ('childcare', 'GENERAL_SERVICES_CHILDCARE'),
    ('consulting and legal', 'GENERAL_SERVICES_CONSULTING_AND_LEGAL'),
    ('education', 'GENERAL_SERVICES_EDUCATION'),
    ('insurance', 'GENERAL_SERVICES_INSURANCE'),
    ('postage and shipping', 'GENERAL_SERVICES_POSTAGE_AND_SHIPPING'),
    ('storage', 'GENERAL_SERVICES_STORAGE'),
    ('other general services', 'GENERAL_SERVICES_OTHER_GENERAL_SERVICES'),
    ('donations', 'GOVERNMENT_AND_NON_PROFIT_DONATIONS'),
    ('government departments and agencies', 'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES'),
    ('tax payment', 'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT'),
    ('other government and non profit', 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT'),
    ('bikes and scooters', 'TRANSPORTATION_BIKES_AND_SCOOTERS'),
    ('gas', 'TRANSPORTATION_GAS'),
    ('parking', 'TRANSPORTATION_PARKING'),
    ('public transit', 'TRANSPORTATION_PUBLIC_TRANSIT'),
    ('taxis and ride shares', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES'),
    ('tolls', 'TRANSPORTATION_TOLLS'),
    ('other transportation', 'TRANSPORTATION_OTHER_TRANSPORTATION'),
    ('flights', 'TRAVEL_FLIGHTS'),
    ('lodging', 'TRAVEL_LODGING'),
    ('rental cars', 'TRAVEL_RENTAL_CARS'),
    ('other travel', 'TRAVEL_OTHER_TRAVEL'),
    ('gas and electricity', 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY'),
    ('internet and cable', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE'),
    ('rent', 'RENT_AND_UTILITIES_RENT'),
    ('sewage and waste management', 'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT'),
    ('telephone', 'RENT_AND_UTILITIES_TELEPHONE'),
    ('water', 'RENT_AND_UTILITIES_WATER'),
    ('other utilities', 'RENT_AND_UTILITIES_OTHER_UTILITIES'),
    ('other', 'OTHER_OTHER')
  ) AS t(label_match, plaid_key)
  LOOP
    -- Only update if: 1) matching label exists without plaid_key, 2) no row has this plaid_key yet
    UPDATE public.system_categories 
    SET plaid_category_key = r.plaid_key
    WHERE LOWER(label) = r.label_match 
      AND plaid_category_key IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = r.plaid_key);
  END LOOP;
END $$;

-- ============================================================================
-- STEP 5: Insert system_categories that don't exist yet
-- Check both plaid_category_key AND (label, group_id) to avoid conflicts
-- ============================================================================

-- INCOME subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('INCOME')
FROM (VALUES
  ('Child Support', 'INCOME_CHILD_SUPPORT'),
  ('Dividends', 'INCOME_DIVIDENDS'),
  ('Gig Economy', 'INCOME_GIG_ECONOMY'),
  ('Interest Earned', 'INCOME_INTEREST_EARNED'),
  ('Long Term Disability', 'INCOME_LONG_TERM_DISABILITY'),
  ('Military', 'INCOME_MILITARY'),
  ('Rental', 'INCOME_RENTAL'),
  ('Retirement Pension', 'INCOME_RETIREMENT_PENSION'),
  ('Salary', 'INCOME_SALARY'),
  ('Tax Refund', 'INCOME_TAX_REFUND'),
  ('Unemployment', 'INCOME_UNEMPLOYMENT'),
  ('Other Income', 'INCOME_OTHER')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('INCOME'));

-- LOAN_DISBURSEMENTS subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('LOAN_DISBURSEMENTS')
FROM (VALUES
  ('Auto Loan Disbursement', 'LOAN_DISBURSEMENTS_AUTO'),
  ('Buy Now Pay Later', 'LOAN_DISBURSEMENTS_BNPL'),
  ('Cash Advances', 'LOAN_DISBURSEMENTS_CASH_ADVANCES'),
  ('Earned Wage Access', 'LOAN_DISBURSEMENTS_EWA'),
  ('Mortgage Disbursement', 'LOAN_DISBURSEMENTS_MORTGAGE'),
  ('Personal Loan Disbursement', 'LOAN_DISBURSEMENTS_PERSONAL'),
  ('Student Loan Disbursement', 'LOAN_DISBURSEMENTS_STUDENT'),
  ('Other Disbursement', 'LOAN_DISBURSEMENTS_OTHER_DISBURSEMENT')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('LOAN_DISBURSEMENTS'));

-- LOAN_PAYMENTS subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('LOAN_PAYMENTS')
FROM (VALUES
  ('Car Payment', 'LOAN_PAYMENTS_CAR_PAYMENT'),
  ('Cash Advances Payment', 'LOAN_PAYMENTS_CASH_ADVANCES'),
  ('Credit Card Payment', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'),
  ('Earned Wage Access Payment', 'LOAN_PAYMENTS_EWA'),
  ('Mortgage Payment', 'LOAN_PAYMENTS_MORTGAGE_PAYMENT'),
  ('Personal Loan Payment', 'LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT'),
  ('Student Loan Payment', 'LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT'),
  ('Other Payment', 'LOAN_PAYMENTS_OTHER_PAYMENT')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('LOAN_PAYMENTS'));

-- TRANSFER_IN subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('TRANSFER_IN')
FROM (VALUES
  ('Account Transfer', 'TRANSFER_IN_ACCOUNT_TRANSFER'),
  ('Deposit', 'TRANSFER_IN_DEPOSIT'),
  ('Investment and Retirement Funds', 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS'),
  ('Savings', 'TRANSFER_IN_SAVINGS'),
  ('Wire Transfer In', 'TRANSFER_IN_WIRE'),
  ('Other Transfer In', 'TRANSFER_IN_OTHER_TRANSFER_IN')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('TRANSFER_IN'));

-- TRANSFER_OUT subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('TRANSFER_OUT')
FROM (VALUES
  ('Account Transfer Out', 'TRANSFER_OUT_ACCOUNT_TRANSFER'),
  ('Investment and Retirement Funds Out', 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS'),
  ('Savings Out', 'TRANSFER_OUT_SAVINGS'),
  ('Wire Transfer Out', 'TRANSFER_OUT_WIRE'),
  ('Withdrawal', 'TRANSFER_OUT_WITHDRAWAL'),
  ('Other Transfer Out', 'TRANSFER_OUT_OTHER_TRANSFER_OUT')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('TRANSFER_OUT'));

-- BANK_FEES subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('BANK_FEES')
FROM (VALUES
  ('Atm Fees', 'BANK_FEES_ATM_FEES'),
  ('Insufficient Funds', 'BANK_FEES_INSUFFICIENT_FUNDS'),
  ('Interest Charge', 'BANK_FEES_INTEREST_CHARGE'),
  ('Foreign Transaction Fees', 'BANK_FEES_FOREIGN_TRANSACTION_FEES'),
  ('Overdraft Fees', 'BANK_FEES_OVERDRAFT_FEES'),
  ('Late Fees', 'BANK_FEES_LATE_FEES'),
  ('Cash Advance Fee', 'BANK_FEES_CASH_ADVANCE'),
  ('Other Bank Fees', 'BANK_FEES_OTHER_BANK_FEES')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('BANK_FEES'));

-- ENTERTAINMENT subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('ENTERTAINMENT')
FROM (VALUES
  ('Casinos and Gambling', 'ENTERTAINMENT_CASINOS_AND_GAMBLING'),
  ('Music and Audio', 'ENTERTAINMENT_MUSIC_AND_AUDIO'),
  ('Sporting Events Amusement Parks and Museums', 'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS'),
  ('Tv and Movies', 'ENTERTAINMENT_TV_AND_MOVIES'),
  ('Video Games', 'ENTERTAINMENT_VIDEO_GAMES'),
  ('Other Entertainment', 'ENTERTAINMENT_OTHER_ENTERTAINMENT')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('ENTERTAINMENT'));

-- FOOD_AND_DRINK subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('FOOD_AND_DRINK')
FROM (VALUES
  ('Beer Wine and Liquor', 'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR'),
  ('Coffee', 'FOOD_AND_DRINK_COFFEE'),
  ('Fast Food', 'FOOD_AND_DRINK_FAST_FOOD'),
  ('Groceries', 'FOOD_AND_DRINK_GROCERIES'),
  ('Restaurant', 'FOOD_AND_DRINK_RESTAURANT'),
  ('Vending Machines', 'FOOD_AND_DRINK_VENDING_MACHINES'),
  ('Other Food and Drink', 'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('FOOD_AND_DRINK'));

-- GENERAL_MERCHANDISE subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('GENERAL_MERCHANDISE')
FROM (VALUES
  ('Bookstores and Newsstands', 'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS'),
  ('Clothing and Accessories', 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES'),
  ('Convenience Stores', 'GENERAL_MERCHANDISE_CONVENIENCE_STORES'),
  ('Department Stores', 'GENERAL_MERCHANDISE_DEPARTMENT_STORES'),
  ('Discount Stores', 'GENERAL_MERCHANDISE_DISCOUNT_STORES'),
  ('Electronics', 'GENERAL_MERCHANDISE_ELECTRONICS'),
  ('Gifts and Novelties', 'GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES'),
  ('Office Supplies', 'GENERAL_MERCHANDISE_OFFICE_SUPPLIES'),
  ('Online Marketplaces', 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES'),
  ('Pet Supplies', 'GENERAL_MERCHANDISE_PET_SUPPLIES'),
  ('Sporting Goods', 'GENERAL_MERCHANDISE_SPORTING_GOODS'),
  ('Superstores', 'GENERAL_MERCHANDISE_SUPERSTORES'),
  ('Tobacco and Vape', 'GENERAL_MERCHANDISE_TOBACCO_AND_VAPE'),
  ('Other General Merchandise', 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('GENERAL_MERCHANDISE'));

-- HOME_IMPROVEMENT subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('HOME_IMPROVEMENT')
FROM (VALUES
  ('Furniture', 'HOME_IMPROVEMENT_FURNITURE'),
  ('Hardware', 'HOME_IMPROVEMENT_HARDWARE'),
  ('Repair and Maintenance', 'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE'),
  ('Security', 'HOME_IMPROVEMENT_SECURITY'),
  ('Other Home Improvement', 'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('HOME_IMPROVEMENT'));

-- MEDICAL subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('MEDICAL')
FROM (VALUES
  ('Dental Care', 'MEDICAL_DENTAL_CARE'),
  ('Eye Care', 'MEDICAL_EYE_CARE'),
  ('Nursing Care', 'MEDICAL_NURSING_CARE'),
  ('Pharmacies and Supplements', 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS'),
  ('Primary Care', 'MEDICAL_PRIMARY_CARE'),
  ('Veterinary Services', 'MEDICAL_VETERINARY_SERVICES'),
  ('Other Medical', 'MEDICAL_OTHER_MEDICAL')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('MEDICAL'));

-- PERSONAL_CARE subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('PERSONAL_CARE')
FROM (VALUES
  ('Gyms and Fitness Centers', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS'),
  ('Hair and Beauty', 'PERSONAL_CARE_HAIR_AND_BEAUTY'),
  ('Laundry and Dry Cleaning', 'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING'),
  ('Other Personal Care', 'PERSONAL_CARE_OTHER_PERSONAL_CARE')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('PERSONAL_CARE'));

-- GENERAL_SERVICES subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('GENERAL_SERVICES')
FROM (VALUES
  ('Accounting and Financial Planning', 'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING'),
  ('Automotive', 'GENERAL_SERVICES_AUTOMOTIVE'),
  ('Childcare', 'GENERAL_SERVICES_CHILDCARE'),
  ('Consulting and Legal', 'GENERAL_SERVICES_CONSULTING_AND_LEGAL'),
  ('Education', 'GENERAL_SERVICES_EDUCATION'),
  ('Insurance', 'GENERAL_SERVICES_INSURANCE'),
  ('Postage and Shipping', 'GENERAL_SERVICES_POSTAGE_AND_SHIPPING'),
  ('Storage', 'GENERAL_SERVICES_STORAGE'),
  ('Other General Services', 'GENERAL_SERVICES_OTHER_GENERAL_SERVICES')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('GENERAL_SERVICES'));

-- GOVERNMENT_AND_NON_PROFIT subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('GOVERNMENT_AND_NON_PROFIT')
FROM (VALUES
  ('Donations', 'GOVERNMENT_AND_NON_PROFIT_DONATIONS'),
  ('Government Departments and Agencies', 'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES'),
  ('Tax Payment', 'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT'),
  ('Other Government and Non Profit', 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('GOVERNMENT_AND_NON_PROFIT'));

-- TRANSPORTATION subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('TRANSPORTATION')
FROM (VALUES
  ('Bikes and Scooters', 'TRANSPORTATION_BIKES_AND_SCOOTERS'),
  ('Gas', 'TRANSPORTATION_GAS'),
  ('Parking', 'TRANSPORTATION_PARKING'),
  ('Public Transit', 'TRANSPORTATION_PUBLIC_TRANSIT'),
  ('Taxis and Ride Shares', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES'),
  ('Tolls', 'TRANSPORTATION_TOLLS'),
  ('Other Transportation', 'TRANSPORTATION_OTHER_TRANSPORTATION')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('TRANSPORTATION'));

-- TRAVEL subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('TRAVEL')
FROM (VALUES
  ('Flights', 'TRAVEL_FLIGHTS'),
  ('Lodging', 'TRAVEL_LODGING'),
  ('Rental Cars', 'TRAVEL_RENTAL_CARS'),
  ('Other Travel', 'TRAVEL_OTHER_TRAVEL')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('TRAVEL'));

-- RENT_AND_UTILITIES subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('RENT_AND_UTILITIES')
FROM (VALUES
  ('Gas and Electricity', 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY'),
  ('Internet and Cable', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE'),
  ('Rent', 'RENT_AND_UTILITIES_RENT'),
  ('Sewage and Waste Management', 'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT'),
  ('Telephone', 'RENT_AND_UTILITIES_TELEPHONE'),
  ('Water', 'RENT_AND_UTILITIES_WATER'),
  ('Other Utilities', 'RENT_AND_UTILITIES_OTHER_UTILITIES')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('RENT_AND_UTILITIES'));

-- OTHER subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('OTHER')
FROM (VALUES
  ('Other', 'OTHER_OTHER')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_category_group_id('OTHER'));

-- Clean up helper function
DROP FUNCTION IF EXISTS get_category_group_id(VARCHAR);
