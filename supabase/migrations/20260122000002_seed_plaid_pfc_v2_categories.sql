-- Seed all Plaid Personal Finance Categories (PFCv2)
-- This migration pre-populates all categories so users can categorize transactions
-- even if they haven't encountered that category type yet.
-- Uses ON CONFLICT DO UPDATE to safely handle existing categories.

-- ============================================================================
-- STEP 1: Insert/Update all PRIMARY categories (category_groups)
-- ============================================================================

INSERT INTO public.category_groups (name, plaid_category_key, icon_url, hex_color)
VALUES
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
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL
DO UPDATE SET
  icon_url = EXCLUDED.icon_url,
  updated_at = NOW();

-- ============================================================================
-- STEP 2: Insert all DETAILED categories (system_categories)
-- ============================================================================

-- Helper function to get category group ID by plaid key
CREATE OR REPLACE FUNCTION get_category_group_id(p_key VARCHAR) RETURNS UUID AS $$
  SELECT id FROM public.category_groups WHERE plaid_category_key = p_key LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- INCOME subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Child Support', 'INCOME_CHILD_SUPPORT', get_category_group_id('INCOME')),
  ('Dividends', 'INCOME_DIVIDENDS', get_category_group_id('INCOME')),
  ('Gig Economy', 'INCOME_GIG_ECONOMY', get_category_group_id('INCOME')),
  ('Interest Earned', 'INCOME_INTEREST_EARNED', get_category_group_id('INCOME')),
  ('Long Term Disability', 'INCOME_LONG_TERM_DISABILITY', get_category_group_id('INCOME')),
  ('Military', 'INCOME_MILITARY', get_category_group_id('INCOME')),
  ('Rental', 'INCOME_RENTAL', get_category_group_id('INCOME')),
  ('Retirement Pension', 'INCOME_RETIREMENT_PENSION', get_category_group_id('INCOME')),
  ('Salary', 'INCOME_SALARY', get_category_group_id('INCOME')),
  ('Tax Refund', 'INCOME_TAX_REFUND', get_category_group_id('INCOME')),
  ('Unemployment', 'INCOME_UNEMPLOYMENT', get_category_group_id('INCOME')),
  ('Other Income', 'INCOME_OTHER', get_category_group_id('INCOME'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- LOAN_DISBURSEMENTS subcategories (NEW in PFCv2)
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Auto Loan Disbursement', 'LOAN_DISBURSEMENTS_AUTO', get_category_group_id('LOAN_DISBURSEMENTS')),
  ('Buy Now Pay Later', 'LOAN_DISBURSEMENTS_BNPL', get_category_group_id('LOAN_DISBURSEMENTS')),
  ('Cash Advances', 'LOAN_DISBURSEMENTS_CASH_ADVANCES', get_category_group_id('LOAN_DISBURSEMENTS')),
  ('Earned Wage Access', 'LOAN_DISBURSEMENTS_EWA', get_category_group_id('LOAN_DISBURSEMENTS')),
  ('Mortgage Disbursement', 'LOAN_DISBURSEMENTS_MORTGAGE', get_category_group_id('LOAN_DISBURSEMENTS')),
  ('Personal Loan Disbursement', 'LOAN_DISBURSEMENTS_PERSONAL', get_category_group_id('LOAN_DISBURSEMENTS')),
  ('Student Loan Disbursement', 'LOAN_DISBURSEMENTS_STUDENT', get_category_group_id('LOAN_DISBURSEMENTS')),
  ('Other Disbursement', 'LOAN_DISBURSEMENTS_OTHER_DISBURSEMENT', get_category_group_id('LOAN_DISBURSEMENTS'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- LOAN_PAYMENTS subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Car Payment', 'LOAN_PAYMENTS_CAR_PAYMENT', get_category_group_id('LOAN_PAYMENTS')),
  ('Cash Advances Payment', 'LOAN_PAYMENTS_CASH_ADVANCES', get_category_group_id('LOAN_PAYMENTS')),
  ('Credit Card Payment', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT', get_category_group_id('LOAN_PAYMENTS')),
  ('Earned Wage Access Payment', 'LOAN_PAYMENTS_EWA', get_category_group_id('LOAN_PAYMENTS')),
  ('Mortgage Payment', 'LOAN_PAYMENTS_MORTGAGE_PAYMENT', get_category_group_id('LOAN_PAYMENTS')),
  ('Personal Loan Payment', 'LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT', get_category_group_id('LOAN_PAYMENTS')),
  ('Student Loan Payment', 'LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT', get_category_group_id('LOAN_PAYMENTS')),
  ('Other Payment', 'LOAN_PAYMENTS_OTHER_PAYMENT', get_category_group_id('LOAN_PAYMENTS'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- TRANSFER_IN subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Account Transfer', 'TRANSFER_IN_ACCOUNT_TRANSFER', get_category_group_id('TRANSFER_IN')),
  ('Deposit', 'TRANSFER_IN_DEPOSIT', get_category_group_id('TRANSFER_IN')),
  ('Investment and Retirement Funds', 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS', get_category_group_id('TRANSFER_IN')),
  ('Savings', 'TRANSFER_IN_SAVINGS', get_category_group_id('TRANSFER_IN')),
  ('Wire Transfer In', 'TRANSFER_IN_WIRE', get_category_group_id('TRANSFER_IN')),
  ('Other Transfer In', 'TRANSFER_IN_OTHER_TRANSFER_IN', get_category_group_id('TRANSFER_IN'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- TRANSFER_OUT subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Account Transfer Out', 'TRANSFER_OUT_ACCOUNT_TRANSFER', get_category_group_id('TRANSFER_OUT')),
  ('Investment and Retirement Funds Out', 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS', get_category_group_id('TRANSFER_OUT')),
  ('Savings Out', 'TRANSFER_OUT_SAVINGS', get_category_group_id('TRANSFER_OUT')),
  ('Wire Transfer Out', 'TRANSFER_OUT_WIRE', get_category_group_id('TRANSFER_OUT')),
  ('Withdrawal', 'TRANSFER_OUT_WITHDRAWAL', get_category_group_id('TRANSFER_OUT')),
  ('Other Transfer Out', 'TRANSFER_OUT_OTHER_TRANSFER_OUT', get_category_group_id('TRANSFER_OUT'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- BANK_FEES subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Atm Fees', 'BANK_FEES_ATM_FEES', get_category_group_id('BANK_FEES')),
  ('Insufficient Funds', 'BANK_FEES_INSUFFICIENT_FUNDS', get_category_group_id('BANK_FEES')),
  ('Interest Charge', 'BANK_FEES_INTEREST_CHARGE', get_category_group_id('BANK_FEES')),
  ('Foreign Transaction Fees', 'BANK_FEES_FOREIGN_TRANSACTION_FEES', get_category_group_id('BANK_FEES')),
  ('Overdraft Fees', 'BANK_FEES_OVERDRAFT_FEES', get_category_group_id('BANK_FEES')),
  ('Late Fees', 'BANK_FEES_LATE_FEES', get_category_group_id('BANK_FEES')),
  ('Cash Advance Fee', 'BANK_FEES_CASH_ADVANCE', get_category_group_id('BANK_FEES')),
  ('Other Bank Fees', 'BANK_FEES_OTHER_BANK_FEES', get_category_group_id('BANK_FEES'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- ENTERTAINMENT subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Casinos and Gambling', 'ENTERTAINMENT_CASINOS_AND_GAMBLING', get_category_group_id('ENTERTAINMENT')),
  ('Music and Audio', 'ENTERTAINMENT_MUSIC_AND_AUDIO', get_category_group_id('ENTERTAINMENT')),
  ('Sporting Events Amusement Parks and Museums', 'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS', get_category_group_id('ENTERTAINMENT')),
  ('Tv and Movies', 'ENTERTAINMENT_TV_AND_MOVIES', get_category_group_id('ENTERTAINMENT')),
  ('Video Games', 'ENTERTAINMENT_VIDEO_GAMES', get_category_group_id('ENTERTAINMENT')),
  ('Other Entertainment', 'ENTERTAINMENT_OTHER_ENTERTAINMENT', get_category_group_id('ENTERTAINMENT'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- FOOD_AND_DRINK subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Beer Wine and Liquor', 'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR', get_category_group_id('FOOD_AND_DRINK')),
  ('Coffee', 'FOOD_AND_DRINK_COFFEE', get_category_group_id('FOOD_AND_DRINK')),
  ('Fast Food', 'FOOD_AND_DRINK_FAST_FOOD', get_category_group_id('FOOD_AND_DRINK')),
  ('Groceries', 'FOOD_AND_DRINK_GROCERIES', get_category_group_id('FOOD_AND_DRINK')),
  ('Restaurant', 'FOOD_AND_DRINK_RESTAURANT', get_category_group_id('FOOD_AND_DRINK')),
  ('Vending Machines', 'FOOD_AND_DRINK_VENDING_MACHINES', get_category_group_id('FOOD_AND_DRINK')),
  ('Other Food and Drink', 'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK', get_category_group_id('FOOD_AND_DRINK'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- GENERAL_MERCHANDISE subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Bookstores and Newsstands', 'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Clothing and Accessories', 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Convenience Stores', 'GENERAL_MERCHANDISE_CONVENIENCE_STORES', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Department Stores', 'GENERAL_MERCHANDISE_DEPARTMENT_STORES', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Discount Stores', 'GENERAL_MERCHANDISE_DISCOUNT_STORES', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Electronics', 'GENERAL_MERCHANDISE_ELECTRONICS', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Gifts and Novelties', 'GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Office Supplies', 'GENERAL_MERCHANDISE_OFFICE_SUPPLIES', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Online Marketplaces', 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Pet Supplies', 'GENERAL_MERCHANDISE_PET_SUPPLIES', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Sporting Goods', 'GENERAL_MERCHANDISE_SPORTING_GOODS', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Superstores', 'GENERAL_MERCHANDISE_SUPERSTORES', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Tobacco and Vape', 'GENERAL_MERCHANDISE_TOBACCO_AND_VAPE', get_category_group_id('GENERAL_MERCHANDISE')),
  ('Other General Merchandise', 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE', get_category_group_id('GENERAL_MERCHANDISE'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- HOME_IMPROVEMENT subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Furniture', 'HOME_IMPROVEMENT_FURNITURE', get_category_group_id('HOME_IMPROVEMENT')),
  ('Hardware', 'HOME_IMPROVEMENT_HARDWARE', get_category_group_id('HOME_IMPROVEMENT')),
  ('Repair and Maintenance', 'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE', get_category_group_id('HOME_IMPROVEMENT')),
  ('Security', 'HOME_IMPROVEMENT_SECURITY', get_category_group_id('HOME_IMPROVEMENT')),
  ('Other Home Improvement', 'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT', get_category_group_id('HOME_IMPROVEMENT'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- MEDICAL subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Dental Care', 'MEDICAL_DENTAL_CARE', get_category_group_id('MEDICAL')),
  ('Eye Care', 'MEDICAL_EYE_CARE', get_category_group_id('MEDICAL')),
  ('Nursing Care', 'MEDICAL_NURSING_CARE', get_category_group_id('MEDICAL')),
  ('Pharmacies and Supplements', 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS', get_category_group_id('MEDICAL')),
  ('Primary Care', 'MEDICAL_PRIMARY_CARE', get_category_group_id('MEDICAL')),
  ('Veterinary Services', 'MEDICAL_VETERINARY_SERVICES', get_category_group_id('MEDICAL')),
  ('Other Medical', 'MEDICAL_OTHER_MEDICAL', get_category_group_id('MEDICAL'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- PERSONAL_CARE subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Gyms and Fitness Centers', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS', get_category_group_id('PERSONAL_CARE')),
  ('Hair and Beauty', 'PERSONAL_CARE_HAIR_AND_BEAUTY', get_category_group_id('PERSONAL_CARE')),
  ('Laundry and Dry Cleaning', 'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING', get_category_group_id('PERSONAL_CARE')),
  ('Other Personal Care', 'PERSONAL_CARE_OTHER_PERSONAL_CARE', get_category_group_id('PERSONAL_CARE'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- GENERAL_SERVICES subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Accounting and Financial Planning', 'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING', get_category_group_id('GENERAL_SERVICES')),
  ('Automotive', 'GENERAL_SERVICES_AUTOMOTIVE', get_category_group_id('GENERAL_SERVICES')),
  ('Childcare', 'GENERAL_SERVICES_CHILDCARE', get_category_group_id('GENERAL_SERVICES')),
  ('Consulting and Legal', 'GENERAL_SERVICES_CONSULTING_AND_LEGAL', get_category_group_id('GENERAL_SERVICES')),
  ('Education', 'GENERAL_SERVICES_EDUCATION', get_category_group_id('GENERAL_SERVICES')),
  ('Insurance', 'GENERAL_SERVICES_INSURANCE', get_category_group_id('GENERAL_SERVICES')),
  ('Postage and Shipping', 'GENERAL_SERVICES_POSTAGE_AND_SHIPPING', get_category_group_id('GENERAL_SERVICES')),
  ('Storage', 'GENERAL_SERVICES_STORAGE', get_category_group_id('GENERAL_SERVICES')),
  ('Other General Services', 'GENERAL_SERVICES_OTHER_GENERAL_SERVICES', get_category_group_id('GENERAL_SERVICES'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- GOVERNMENT_AND_NON_PROFIT subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Donations', 'GOVERNMENT_AND_NON_PROFIT_DONATIONS', get_category_group_id('GOVERNMENT_AND_NON_PROFIT')),
  ('Government Departments and Agencies', 'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES', get_category_group_id('GOVERNMENT_AND_NON_PROFIT')),
  ('Tax Payment', 'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT', get_category_group_id('GOVERNMENT_AND_NON_PROFIT')),
  ('Other Government and Non Profit', 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT', get_category_group_id('GOVERNMENT_AND_NON_PROFIT'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- TRANSPORTATION subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Bikes and Scooters', 'TRANSPORTATION_BIKES_AND_SCOOTERS', get_category_group_id('TRANSPORTATION')),
  ('Gas', 'TRANSPORTATION_GAS', get_category_group_id('TRANSPORTATION')),
  ('Parking', 'TRANSPORTATION_PARKING', get_category_group_id('TRANSPORTATION')),
  ('Public Transit', 'TRANSPORTATION_PUBLIC_TRANSIT', get_category_group_id('TRANSPORTATION')),
  ('Taxis and Ride Shares', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES', get_category_group_id('TRANSPORTATION')),
  ('Tolls', 'TRANSPORTATION_TOLLS', get_category_group_id('TRANSPORTATION')),
  ('Other Transportation', 'TRANSPORTATION_OTHER_TRANSPORTATION', get_category_group_id('TRANSPORTATION'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- TRAVEL subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Flights', 'TRAVEL_FLIGHTS', get_category_group_id('TRAVEL')),
  ('Lodging', 'TRAVEL_LODGING', get_category_group_id('TRAVEL')),
  ('Rental Cars', 'TRAVEL_RENTAL_CARS', get_category_group_id('TRAVEL')),
  ('Other Travel', 'TRAVEL_OTHER_TRAVEL', get_category_group_id('TRAVEL'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- RENT_AND_UTILITIES subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Gas and Electricity', 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY', get_category_group_id('RENT_AND_UTILITIES')),
  ('Internet and Cable', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE', get_category_group_id('RENT_AND_UTILITIES')),
  ('Rent', 'RENT_AND_UTILITIES_RENT', get_category_group_id('RENT_AND_UTILITIES')),
  ('Sewage and Waste Management', 'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT', get_category_group_id('RENT_AND_UTILITIES')),
  ('Telephone', 'RENT_AND_UTILITIES_TELEPHONE', get_category_group_id('RENT_AND_UTILITIES')),
  ('Water', 'RENT_AND_UTILITIES_WATER', get_category_group_id('RENT_AND_UTILITIES')),
  ('Other Utilities', 'RENT_AND_UTILITIES_OTHER_UTILITIES', get_category_group_id('RENT_AND_UTILITIES'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- OTHER subcategories
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
VALUES
  ('Other', 'OTHER_OTHER', get_category_group_id('OTHER'))
ON CONFLICT (plaid_category_key) WHERE plaid_category_key IS NOT NULL DO NOTHING;

-- Clean up helper function
DROP FUNCTION IF EXISTS get_category_group_id(VARCHAR);
