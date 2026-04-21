-- Re-seed all missing Plaid PFCv2 categories with proper group_id
-- Now that category_groups have plaid_category_key set, the lookup will work

-- Helper function to get category group ID by plaid key
CREATE OR REPLACE FUNCTION get_cg_id(p_key VARCHAR) RETURNS UUID AS $$
  SELECT id FROM public.category_groups WHERE plaid_category_key = p_key LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- INCOME
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('INCOME') FROM (VALUES
  ('Child Support', 'INCOME_CHILD_SUPPORT'), ('Dividends', 'INCOME_DIVIDENDS'),
  ('Gig Economy', 'INCOME_GIG_ECONOMY'), ('Interest Earned', 'INCOME_INTEREST_EARNED'),
  ('Long Term Disability', 'INCOME_LONG_TERM_DISABILITY'), ('Military', 'INCOME_MILITARY'),
  ('Rental', 'INCOME_RENTAL'), ('Retirement Pension', 'INCOME_RETIREMENT_PENSION'),
  ('Salary', 'INCOME_SALARY'), ('Tax Refund', 'INCOME_TAX_REFUND'),
  ('Unemployment', 'INCOME_UNEMPLOYMENT'), ('Other Income', 'INCOME_OTHER')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('INCOME'));

-- LOAN_DISBURSEMENTS
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('LOAN_DISBURSEMENTS') FROM (VALUES
  ('Auto Loan Disbursement', 'LOAN_DISBURSEMENTS_AUTO'), ('Buy Now Pay Later', 'LOAN_DISBURSEMENTS_BNPL'),
  ('Cash Advances', 'LOAN_DISBURSEMENTS_CASH_ADVANCES'), ('Earned Wage Access', 'LOAN_DISBURSEMENTS_EWA'),
  ('Mortgage Disbursement', 'LOAN_DISBURSEMENTS_MORTGAGE'), ('Personal Loan Disbursement', 'LOAN_DISBURSEMENTS_PERSONAL'),
  ('Student Loan Disbursement', 'LOAN_DISBURSEMENTS_STUDENT'), ('Other Disbursement', 'LOAN_DISBURSEMENTS_OTHER_DISBURSEMENT')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('LOAN_DISBURSEMENTS'));

-- LOAN_PAYMENTS
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('LOAN_PAYMENTS') FROM (VALUES
  ('Car Payment', 'LOAN_PAYMENTS_CAR_PAYMENT'), ('Cash Advances Payment', 'LOAN_PAYMENTS_CASH_ADVANCES'),
  ('Credit Card Payment', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'), ('Earned Wage Access Payment', 'LOAN_PAYMENTS_EWA'),
  ('Mortgage Payment', 'LOAN_PAYMENTS_MORTGAGE_PAYMENT'), ('Personal Loan Payment', 'LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT'),
  ('Student Loan Payment', 'LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT'), ('Other Payment', 'LOAN_PAYMENTS_OTHER_PAYMENT')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('LOAN_PAYMENTS'));

-- TRANSFER_IN
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('TRANSFER_IN') FROM (VALUES
  ('Account Transfer', 'TRANSFER_IN_ACCOUNT_TRANSFER'), ('Deposit', 'TRANSFER_IN_DEPOSIT'),
  ('Investment and Retirement Funds', 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS'), ('Savings', 'TRANSFER_IN_SAVINGS'),
  ('Wire Transfer In', 'TRANSFER_IN_WIRE'), ('Other Transfer In', 'TRANSFER_IN_OTHER_TRANSFER_IN')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('TRANSFER_IN'));

-- TRANSFER_OUT
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('TRANSFER_OUT') FROM (VALUES
  ('Account Transfer Out', 'TRANSFER_OUT_ACCOUNT_TRANSFER'), ('Investment and Retirement Funds Out', 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS'),
  ('Savings Out', 'TRANSFER_OUT_SAVINGS'), ('Wire Transfer Out', 'TRANSFER_OUT_WIRE'),
  ('Withdrawal', 'TRANSFER_OUT_WITHDRAWAL'), ('Other Transfer Out', 'TRANSFER_OUT_OTHER_TRANSFER_OUT')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('TRANSFER_OUT'));

-- BANK_FEES
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('BANK_FEES') FROM (VALUES
  ('Atm Fees', 'BANK_FEES_ATM_FEES'), ('Insufficient Funds', 'BANK_FEES_INSUFFICIENT_FUNDS'),
  ('Interest Charge', 'BANK_FEES_INTEREST_CHARGE'), ('Foreign Transaction Fees', 'BANK_FEES_FOREIGN_TRANSACTION_FEES'),
  ('Overdraft Fees', 'BANK_FEES_OVERDRAFT_FEES'), ('Late Fees', 'BANK_FEES_LATE_FEES'),
  ('Cash Advance Fee', 'BANK_FEES_CASH_ADVANCE'), ('Other Bank Fees', 'BANK_FEES_OTHER_BANK_FEES')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('BANK_FEES'));

-- ENTERTAINMENT
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('ENTERTAINMENT') FROM (VALUES
  ('Casinos and Gambling', 'ENTERTAINMENT_CASINOS_AND_GAMBLING'), ('Music and Audio', 'ENTERTAINMENT_MUSIC_AND_AUDIO'),
  ('Sporting Events Amusement Parks and Museums', 'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS'),
  ('Tv and Movies', 'ENTERTAINMENT_TV_AND_MOVIES'), ('Video Games', 'ENTERTAINMENT_VIDEO_GAMES'),
  ('Other Entertainment', 'ENTERTAINMENT_OTHER_ENTERTAINMENT')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('ENTERTAINMENT'));

-- FOOD_AND_DRINK
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('FOOD_AND_DRINK') FROM (VALUES
  ('Beer Wine and Liquor', 'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR'), ('Coffee', 'FOOD_AND_DRINK_COFFEE'),
  ('Fast Food', 'FOOD_AND_DRINK_FAST_FOOD'), ('Groceries', 'FOOD_AND_DRINK_GROCERIES'),
  ('Restaurant', 'FOOD_AND_DRINK_RESTAURANT'), ('Vending Machines', 'FOOD_AND_DRINK_VENDING_MACHINES'),
  ('Other Food and Drink', 'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('FOOD_AND_DRINK'));

-- GENERAL_MERCHANDISE
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('GENERAL_MERCHANDISE') FROM (VALUES
  ('Bookstores and Newsstands', 'GENERAL_MERCHANDISE_BOOKSTORES_AND_NEWSSTANDS'),
  ('Clothing and Accessories', 'GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES'),
  ('Convenience Stores', 'GENERAL_MERCHANDISE_CONVENIENCE_STORES'),
  ('Department Stores', 'GENERAL_MERCHANDISE_DEPARTMENT_STORES'),
  ('Discount Stores', 'GENERAL_MERCHANDISE_DISCOUNT_STORES'), ('Electronics', 'GENERAL_MERCHANDISE_ELECTRONICS'),
  ('Gifts and Novelties', 'GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES'),
  ('Office Supplies', 'GENERAL_MERCHANDISE_OFFICE_SUPPLIES'),
  ('Online Marketplaces', 'GENERAL_MERCHANDISE_ONLINE_MARKETPLACES'),
  ('Pet Supplies', 'GENERAL_MERCHANDISE_PET_SUPPLIES'), ('Sporting Goods', 'GENERAL_MERCHANDISE_SPORTING_GOODS'),
  ('Superstores', 'GENERAL_MERCHANDISE_SUPERSTORES'), ('Tobacco and Vape', 'GENERAL_MERCHANDISE_TOBACCO_AND_VAPE'),
  ('Other General Merchandise', 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('GENERAL_MERCHANDISE'));

-- HOME_IMPROVEMENT
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('HOME_IMPROVEMENT') FROM (VALUES
  ('Furniture', 'HOME_IMPROVEMENT_FURNITURE'), ('Hardware', 'HOME_IMPROVEMENT_HARDWARE'),
  ('Repair and Maintenance', 'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE'),
  ('Security', 'HOME_IMPROVEMENT_SECURITY'), ('Other Home Improvement', 'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('HOME_IMPROVEMENT'));

-- MEDICAL
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('MEDICAL') FROM (VALUES
  ('Dental Care', 'MEDICAL_DENTAL_CARE'), ('Eye Care', 'MEDICAL_EYE_CARE'),
  ('Nursing Care', 'MEDICAL_NURSING_CARE'), ('Pharmacies and Supplements', 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS'),
  ('Primary Care', 'MEDICAL_PRIMARY_CARE'), ('Veterinary Services', 'MEDICAL_VETERINARY_SERVICES'),
  ('Other Medical', 'MEDICAL_OTHER_MEDICAL')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('MEDICAL'));

-- PERSONAL_CARE
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('PERSONAL_CARE') FROM (VALUES
  ('Gyms and Fitness Centers', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS'),
  ('Hair and Beauty', 'PERSONAL_CARE_HAIR_AND_BEAUTY'),
  ('Laundry and Dry Cleaning', 'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING'),
  ('Other Personal Care', 'PERSONAL_CARE_OTHER_PERSONAL_CARE')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('PERSONAL_CARE'));

-- GENERAL_SERVICES
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('GENERAL_SERVICES') FROM (VALUES
  ('Accounting and Financial Planning', 'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING'),
  ('Automotive', 'GENERAL_SERVICES_AUTOMOTIVE'), ('Childcare', 'GENERAL_SERVICES_CHILDCARE'),
  ('Consulting and Legal', 'GENERAL_SERVICES_CONSULTING_AND_LEGAL'),
  ('Education', 'GENERAL_SERVICES_EDUCATION'), ('Insurance', 'GENERAL_SERVICES_INSURANCE'),
  ('Postage and Shipping', 'GENERAL_SERVICES_POSTAGE_AND_SHIPPING'),
  ('Storage', 'GENERAL_SERVICES_STORAGE'), ('Other General Services', 'GENERAL_SERVICES_OTHER_GENERAL_SERVICES')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('GENERAL_SERVICES'));

-- GOVERNMENT_AND_NON_PROFIT
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('GOVERNMENT_AND_NON_PROFIT') FROM (VALUES
  ('Donations', 'GOVERNMENT_AND_NON_PROFIT_DONATIONS'),
  ('Government Departments and Agencies', 'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES'),
  ('Tax Payment', 'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT'),
  ('Other Government and Non Profit', 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('GOVERNMENT_AND_NON_PROFIT'));

-- TRANSPORTATION
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('TRANSPORTATION') FROM (VALUES
  ('Bikes and Scooters', 'TRANSPORTATION_BIKES_AND_SCOOTERS'), ('Gas', 'TRANSPORTATION_GAS'),
  ('Parking', 'TRANSPORTATION_PARKING'), ('Public Transit', 'TRANSPORTATION_PUBLIC_TRANSIT'),
  ('Taxis and Ride Shares', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES'), ('Tolls', 'TRANSPORTATION_TOLLS'),
  ('Other Transportation', 'TRANSPORTATION_OTHER_TRANSPORTATION')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('TRANSPORTATION'));

-- TRAVEL
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('TRAVEL') FROM (VALUES
  ('Flights', 'TRAVEL_FLIGHTS'), ('Lodging', 'TRAVEL_LODGING'),
  ('Rental Cars', 'TRAVEL_RENTAL_CARS'), ('Other Travel', 'TRAVEL_OTHER_TRAVEL')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('TRAVEL'));

-- RENT_AND_UTILITIES
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('RENT_AND_UTILITIES') FROM (VALUES
  ('Gas and Electricity', 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY'),
  ('Internet and Cable', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE'),
  ('Rent', 'RENT_AND_UTILITIES_RENT'),
  ('Sewage and Waste Management', 'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT'),
  ('Telephone', 'RENT_AND_UTILITIES_TELEPHONE'), ('Water', 'RENT_AND_UTILITIES_WATER'),
  ('Other Utilities', 'RENT_AND_UTILITIES_OTHER_UTILITIES')
) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('RENT_AND_UTILITIES'));

-- OTHER
INSERT INTO public.system_categories (label, plaid_category_key, group_id)
SELECT v.label, v.pk, get_cg_id('OTHER') FROM (VALUES ('Other', 'OTHER_OTHER')) AS v(label, pk)
WHERE NOT EXISTS (SELECT 1 FROM public.system_categories WHERE plaid_category_key = v.pk)
  AND NOT EXISTS (SELECT 1 FROM public.system_categories WHERE label = v.label AND group_id = get_cg_id('OTHER'));

-- Cleanup
DROP FUNCTION IF EXISTS get_cg_id(VARCHAR);
