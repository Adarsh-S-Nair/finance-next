-- Seed all Plaid Personal Finance Categories (PFCv2)
-- This migration handles both existing categories (updates them) and new categories (inserts them)

-- ============================================================================
-- STEP 1: Update existing category_groups with plaid_category_key and icon_url
-- ============================================================================

-- First, update any existing category groups to have their plaid_category_key
UPDATE public.category_groups SET plaid_category_key = 'INCOME', icon_url = 'https://plaid-category-icons.plaid.com/PFC_INCOME.png' WHERE LOWER(name) = 'income' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'LOAN_DISBURSEMENTS', icon_url = 'https://plaid-category-icons.plaid.com/PFC_LOAN_DISBURSEMENTS.png' WHERE LOWER(name) = 'loan disbursements' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'LOAN_PAYMENTS', icon_url = 'https://plaid-category-icons.plaid.com/PFC_LOAN_PAYMENTS.png' WHERE LOWER(name) = 'loan payments' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'TRANSFER_IN', icon_url = 'https://plaid-category-icons.plaid.com/PFC_TRANSFER_IN.png' WHERE LOWER(name) = 'transfer in' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'TRANSFER_OUT', icon_url = 'https://plaid-category-icons.plaid.com/PFC_TRANSFER_OUT.png' WHERE LOWER(name) = 'transfer out' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'BANK_FEES', icon_url = 'https://plaid-category-icons.plaid.com/PFC_BANK_FEES.png' WHERE LOWER(name) = 'bank fees' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'ENTERTAINMENT', icon_url = 'https://plaid-category-icons.plaid.com/PFC_ENTERTAINMENT.png' WHERE LOWER(name) = 'entertainment' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'FOOD_AND_DRINK', icon_url = 'https://plaid-category-icons.plaid.com/PFC_FOOD_AND_DRINK.png' WHERE LOWER(name) = 'food and drink' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'GENERAL_MERCHANDISE', icon_url = 'https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png' WHERE LOWER(name) = 'general merchandise' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'HOME_IMPROVEMENT', icon_url = 'https://plaid-category-icons.plaid.com/PFC_HOME_IMPROVEMENT.png' WHERE LOWER(name) = 'home improvement' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'MEDICAL', icon_url = 'https://plaid-category-icons.plaid.com/PFC_MEDICAL.png' WHERE LOWER(name) = 'medical' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'PERSONAL_CARE', icon_url = 'https://plaid-category-icons.plaid.com/PFC_PERSONAL_CARE.png' WHERE LOWER(name) = 'personal care' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'GENERAL_SERVICES', icon_url = 'https://plaid-category-icons.plaid.com/PFC_GENERAL_SERVICES.png' WHERE LOWER(name) = 'general services' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'GOVERNMENT_AND_NON_PROFIT', icon_url = 'https://plaid-category-icons.plaid.com/PFC_GOVERNMENT_AND_NON_PROFIT.png' WHERE LOWER(name) = 'government and non profit' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'TRANSPORTATION', icon_url = 'https://plaid-category-icons.plaid.com/PFC_TRANSPORTATION.png' WHERE LOWER(name) = 'transportation' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'TRAVEL', icon_url = 'https://plaid-category-icons.plaid.com/PFC_TRAVEL.png' WHERE LOWER(name) = 'travel' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'RENT_AND_UTILITIES', icon_url = 'https://plaid-category-icons.plaid.com/PFC_RENT_AND_UTILITIES.png' WHERE LOWER(name) = 'rent and utilities' AND plaid_category_key IS NULL;
UPDATE public.category_groups SET plaid_category_key = 'OTHER', icon_url = 'https://plaid-category-icons.plaid.com/PFC_OTHER.png' WHERE LOWER(name) = 'other' AND plaid_category_key IS NULL;

-- ============================================================================
-- STEP 2: Insert only category_groups that don't exist yet (by plaid_category_key)
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.category_groups WHERE plaid_category_key = v.plaid_category_key
);

-- ============================================================================
-- STEP 3: Update existing system_categories with plaid_category_key
-- ============================================================================

-- Helper function to get category group ID by plaid key
CREATE OR REPLACE FUNCTION get_category_group_id(p_key VARCHAR) RETURNS UUID AS $$
  SELECT id FROM public.category_groups WHERE plaid_category_key = p_key LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Update existing system categories with their plaid keys (matching by label)
UPDATE public.system_categories SET plaid_category_key = 'INCOME_CHILD_SUPPORT' WHERE LOWER(label) = 'child support' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_DIVIDENDS' WHERE LOWER(label) = 'dividends' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_GIG_ECONOMY' WHERE LOWER(label) = 'gig economy' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_INTEREST_EARNED' WHERE LOWER(label) = 'interest earned' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_LONG_TERM_DISABILITY' WHERE LOWER(label) = 'long term disability' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_MILITARY' WHERE LOWER(label) = 'military' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_RENTAL' WHERE LOWER(label) = 'rental' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_RETIREMENT_PENSION' WHERE LOWER(label) = 'retirement pension' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_SALARY' WHERE LOWER(label) IN ('salary', 'wages') AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_TAX_REFUND' WHERE LOWER(label) = 'tax refund' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_UNEMPLOYMENT' WHERE LOWER(label) = 'unemployment' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'INCOME_OTHER' WHERE LOWER(label) = 'other income' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'LOAN_PAYMENTS_CAR_PAYMENT' WHERE LOWER(label) = 'car payment' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' WHERE LOWER(label) = 'credit card payment' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'LOAN_PAYMENTS_MORTGAGE_PAYMENT' WHERE LOWER(label) = 'mortgage payment' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT' WHERE LOWER(label) = 'personal loan payment' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT' WHERE LOWER(label) = 'student loan payment' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'LOAN_PAYMENTS_OTHER_PAYMENT' WHERE LOWER(label) = 'other payment' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'TRANSFER_IN_ACCOUNT_TRANSFER' WHERE LOWER(label) = 'account transfer' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSFER_IN_DEPOSIT' WHERE LOWER(label) = 'deposit' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS' WHERE LOWER(label) = 'investment and retirement funds' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSFER_IN_SAVINGS' WHERE LOWER(label) = 'savings' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSFER_IN_OTHER_TRANSFER_IN' WHERE LOWER(label) = 'other transfer in' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSFER_OUT_WITHDRAWAL' WHERE LOWER(label) = 'withdrawal' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSFER_OUT_OTHER_TRANSFER_OUT' WHERE LOWER(label) = 'other transfer out' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'BANK_FEES_ATM_FEES' WHERE LOWER(label) = 'atm fees' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'BANK_FEES_INSUFFICIENT_FUNDS' WHERE LOWER(label) = 'insufficient funds' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'BANK_FEES_INTEREST_CHARGE' WHERE LOWER(label) = 'interest charge' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'BANK_FEES_FOREIGN_TRANSACTION_FEES' WHERE LOWER(label) = 'foreign transaction fees' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'BANK_FEES_OVERDRAFT_FEES' WHERE LOWER(label) = 'overdraft fees' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'BANK_FEES_OTHER_BANK_FEES' WHERE LOWER(label) = 'other bank fees' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'ENTERTAINMENT_CASINOS_AND_GAMBLING' WHERE LOWER(label) = 'casinos and gambling' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'ENTERTAINMENT_MUSIC_AND_AUDIO' WHERE LOWER(label) = 'music and audio' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS' WHERE LOWER(label) = 'sporting events amusement parks and museums' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'ENTERTAINMENT_TV_AND_MOVIES' WHERE LOWER(label) = 'tv and movies' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'ENTERTAINMENT_VIDEO_GAMES' WHERE LOWER(label) = 'video games' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'ENTERTAINMENT_OTHER_ENTERTAINMENT' WHERE LOWER(label) = 'other entertainment' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR' WHERE LOWER(label) = 'beer wine and liquor' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'FOOD_AND_DRINK_COFFEE' WHERE LOWER(label) = 'coffee' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'FOOD_AND_DRINK_FAST_FOOD' WHERE LOWER(label) = 'fast food' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'FOOD_AND_DRINK_GROCERIES' WHERE LOWER(label) = 'groceries' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'FOOD_AND_DRINK_RESTAURANT' WHERE LOWER(label) = 'restaurant' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'FOOD_AND_DRINK_VENDING_MACHINES' WHERE LOWER(label) = 'vending machines' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK' WHERE LOWER(label) = 'other food and drink' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS' WHERE LOWER(label) = 'bookstores and newsstands' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES' WHERE LOWER(label) = 'clothing and accessories' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_CONVENIENCE_STORES' WHERE LOWER(label) = 'convenience stores' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_DEPARTMENT_STORES' WHERE LOWER(label) = 'department stores' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_DISCOUNT_STORES' WHERE LOWER(label) = 'discount stores' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_ELECTRONICS' WHERE LOWER(label) = 'electronics' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES' WHERE LOWER(label) = 'gifts and novelties' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_OFFICE_SUPPLIES' WHERE LOWER(label) = 'office supplies' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES' WHERE LOWER(label) = 'online marketplaces' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_PET_SUPPLIES' WHERE LOWER(label) = 'pet supplies' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_SPORTING_GOODS' WHERE LOWER(label) = 'sporting goods' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_SUPERSTORES' WHERE LOWER(label) = 'superstores' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_TOBACCO_AND_VAPE' WHERE LOWER(label) = 'tobacco and vape' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE' WHERE LOWER(label) = 'other general merchandise' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'HOME_IMPROVEMENT_FURNITURE' WHERE LOWER(label) = 'furniture' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'HOME_IMPROVEMENT_HARDWARE' WHERE LOWER(label) = 'hardware' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE' WHERE LOWER(label) = 'repair and maintenance' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'HOME_IMPROVEMENT_SECURITY' WHERE LOWER(label) = 'security' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT' WHERE LOWER(label) = 'other home improvement' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'MEDICAL_DENTAL_CARE' WHERE LOWER(label) = 'dental care' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'MEDICAL_EYE_CARE' WHERE LOWER(label) = 'eye care' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'MEDICAL_NURSING_CARE' WHERE LOWER(label) = 'nursing care' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS' WHERE LOWER(label) = 'pharmacies and supplements' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'MEDICAL_PRIMARY_CARE' WHERE LOWER(label) = 'primary care' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'MEDICAL_VETERINARY_SERVICES' WHERE LOWER(label) = 'veterinary services' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'MEDICAL_OTHER_MEDICAL' WHERE LOWER(label) = 'other medical' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS' WHERE LOWER(label) = 'gyms and fitness centers' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'PERSONAL_CARE_HAIR_AND_BEAUTY' WHERE LOWER(label) = 'hair and beauty' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING' WHERE LOWER(label) = 'laundry and dry cleaning' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'PERSONAL_CARE_OTHER_PERSONAL_CARE' WHERE LOWER(label) = 'other personal care' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING' WHERE LOWER(label) = 'accounting and financial planning' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_SERVICES_AUTOMOTIVE' WHERE LOWER(label) = 'automotive' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_SERVICES_CHILDCARE' WHERE LOWER(label) = 'childcare' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_SERVICES_CONSULTING_AND_LEGAL' WHERE LOWER(label) = 'consulting and legal' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_SERVICES_EDUCATION' WHERE LOWER(label) = 'education' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_SERVICES_INSURANCE' WHERE LOWER(label) = 'insurance' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_SERVICES_POSTAGE_AND_SHIPPING' WHERE LOWER(label) = 'postage and shipping' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_SERVICES_STORAGE' WHERE LOWER(label) = 'storage' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GENERAL_SERVICES_OTHER_GENERAL_SERVICES' WHERE LOWER(label) = 'other general services' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'GOVERNMENT_AND_NON_PROFIT_DONATIONS' WHERE LOWER(label) = 'donations' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES' WHERE LOWER(label) = 'government departments and agencies' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT' WHERE LOWER(label) = 'tax payment' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT' WHERE LOWER(label) = 'other government and non profit' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'TRANSPORTATION_BIKES_AND_SCOOTERS' WHERE LOWER(label) = 'bikes and scooters' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSPORTATION_GAS' WHERE LOWER(label) = 'gas' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSPORTATION_PARKING' WHERE LOWER(label) = 'parking' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSPORTATION_PUBLIC_TRANSIT' WHERE LOWER(label) = 'public transit' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES' WHERE LOWER(label) = 'taxis and ride shares' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSPORTATION_TOLLS' WHERE LOWER(label) = 'tolls' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRANSPORTATION_OTHER_TRANSPORTATION' WHERE LOWER(label) = 'other transportation' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'TRAVEL_FLIGHTS' WHERE LOWER(label) = 'flights' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRAVEL_LODGING' WHERE LOWER(label) = 'lodging' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRAVEL_RENTAL_CARS' WHERE LOWER(label) = 'rental cars' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'TRAVEL_OTHER_TRAVEL' WHERE LOWER(label) = 'other travel' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY' WHERE LOWER(label) = 'gas and electricity' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'RENT_AND_UTILITIES_INTERNET_AND_CABLE' WHERE LOWER(label) = 'internet and cable' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'RENT_AND_UTILITIES_RENT' WHERE LOWER(label) = 'rent' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT' WHERE LOWER(label) = 'sewage and waste management' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'RENT_AND_UTILITIES_TELEPHONE' WHERE LOWER(label) = 'telephone' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'RENT_AND_UTILITIES_WATER' WHERE LOWER(label) = 'water' AND plaid_category_key IS NULL;
UPDATE public.system_categories SET plaid_category_key = 'RENT_AND_UTILITIES_OTHER_UTILITIES' WHERE LOWER(label) = 'other utilities' AND plaid_category_key IS NULL;

UPDATE public.system_categories SET plaid_category_key = 'OTHER_OTHER' WHERE LOWER(label) = 'other' AND plaid_category_key IS NULL;

-- ============================================================================
-- STEP 4: Insert only system_categories that don't exist yet
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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

-- PERSONAL_CARE subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('PERSONAL_CARE')
FROM (VALUES
  ('Gyms and Fitness Centers', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS'),
  ('Hair and Beauty', 'PERSONAL_CARE_HAIR_AND_BEAUTY'),
  ('Laundry and Dry Cleaning', 'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING'),
  ('Other Personal Care', 'PERSONAL_CARE_OTHER_PERSONAL_CARE')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

-- GOVERNMENT_AND_NON_PROFIT subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('GOVERNMENT_AND_NON_PROFIT')
FROM (VALUES
  ('Donations', 'GOVERNMENT_AND_NON_PROFIT_DONATIONS'),
  ('Government Departments and Agencies', 'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES'),
  ('Tax Payment', 'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT'),
  ('Other Government and Non Profit', 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

-- TRAVEL subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('TRAVEL')
FROM (VALUES
  ('Flights', 'TRAVEL_FLIGHTS'),
  ('Lodging', 'TRAVEL_LODGING'),
  ('Rental Cars', 'TRAVEL_RENTAL_CARS'),
  ('Other Travel', 'TRAVEL_OTHER_TRAVEL')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

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
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

-- OTHER subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.plaid_key, get_category_group_id('OTHER')
FROM (VALUES
  ('Other', 'OTHER_OTHER')
) AS v(label, plaid_key)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.plaid_key);

-- Clean up helper function
DROP FUNCTION IF EXISTS get_category_group_id(VARCHAR);
