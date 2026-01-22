-- Backfill plaid_category_key for existing categories by matching display names
-- This links categories that were created before the plaid_category_key column existed

-- Update existing category_groups with their Plaid keys based on name matching
UPDATE public.category_groups cg
SET plaid_category_key = mapping.plaid_key
FROM (VALUES 
  ('Income', 'INCOME'),
  ('Loan Disbursements', 'LOAN_DISBURSEMENTS'),
  ('Loan Payments', 'LOAN_PAYMENTS'),
  ('Transfer In', 'TRANSFER_IN'),
  ('Transfer Out', 'TRANSFER_OUT'),
  ('Bank Fees', 'BANK_FEES'),
  ('Entertainment', 'ENTERTAINMENT'),
  ('Food and Drink', 'FOOD_AND_DRINK'),
  ('General Merchandise', 'GENERAL_MERCHANDISE'),
  ('Home Improvement', 'HOME_IMPROVEMENT'),
  ('Medical', 'MEDICAL'),
  ('Personal Care', 'PERSONAL_CARE'),
  ('General Services', 'GENERAL_SERVICES'),
  ('Government and Non Profit', 'GOVERNMENT_AND_NON_PROFIT'),
  ('Transportation', 'TRANSPORTATION'),
  ('Travel', 'TRAVEL'),
  ('Rent and Utilities', 'RENT_AND_UTILITIES'),
  ('Other', 'OTHER')
) AS mapping(display_name, plaid_key)
WHERE LOWER(TRIM(cg.name)) = LOWER(mapping.display_name)
  AND cg.plaid_category_key IS NULL;

-- Update existing system_categories with their Plaid keys based on label matching
-- This is a comprehensive mapping of all detailed categories
UPDATE public.system_categories sc
SET plaid_category_key = mapping.plaid_key
FROM (VALUES 
  -- INCOME
  ('Child Support', 'INCOME_CHILD_SUPPORT'),
  ('Dividends', 'INCOME_DIVIDENDS'),
  ('Gig Economy', 'INCOME_GIG_ECONOMY'),
  ('Interest Earned', 'INCOME_INTEREST_EARNED'),
  ('Long Term Disability', 'INCOME_LONG_TERM_DISABILITY'),
  ('Military', 'INCOME_MILITARY'),
  ('Rental', 'INCOME_RENTAL'),
  ('Retirement Pension', 'INCOME_RETIREMENT_PENSION'),
  ('Salary', 'INCOME_SALARY'),
  ('Wages', 'INCOME_SALARY'), -- Legacy name mapping
  ('Tax Refund', 'INCOME_TAX_REFUND'),
  ('Unemployment', 'INCOME_UNEMPLOYMENT'),
  ('Other Income', 'INCOME_OTHER'),
  
  -- LOAN_DISBURSEMENTS
  ('Auto Loan Disbursement', 'LOAN_DISBURSEMENTS_AUTO'),
  ('Buy Now Pay Later', 'LOAN_DISBURSEMENTS_BNPL'),
  ('Cash Advances', 'LOAN_DISBURSEMENTS_CASH_ADVANCES'),
  ('Earned Wage Access', 'LOAN_DISBURSEMENTS_EWA'),
  ('Mortgage Disbursement', 'LOAN_DISBURSEMENTS_MORTGAGE'),
  ('Personal Loan Disbursement', 'LOAN_DISBURSEMENTS_PERSONAL'),
  ('Student Loan Disbursement', 'LOAN_DISBURSEMENTS_STUDENT'),
  ('Other Disbursement', 'LOAN_DISBURSEMENTS_OTHER_DISBURSEMENT'),
  
  -- LOAN_PAYMENTS
  ('Car Payment', 'LOAN_PAYMENTS_CAR_PAYMENT'),
  ('Cash Advances Payment', 'LOAN_PAYMENTS_CASH_ADVANCES'),
  ('Credit Card Payment', 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'),
  ('Earned Wage Access Payment', 'LOAN_PAYMENTS_EWA'),
  ('Mortgage Payment', 'LOAN_PAYMENTS_MORTGAGE_PAYMENT'),
  ('Personal Loan Payment', 'LOAN_PAYMENTS_PERSONAL_LOAN_PAYMENT'),
  ('Student Loan Payment', 'LOAN_PAYMENTS_STUDENT_LOAN_PAYMENT'),
  ('Other Payment', 'LOAN_PAYMENTS_OTHER_PAYMENT'),
  
  -- TRANSFER_IN
  ('Account Transfer', 'TRANSFER_IN_ACCOUNT_TRANSFER'),
  ('Deposit', 'TRANSFER_IN_DEPOSIT'),
  ('Investment and Retirement Funds', 'TRANSFER_IN_INVESTMENT_AND_RETIREMENT_FUNDS'),
  ('Savings', 'TRANSFER_IN_SAVINGS'),
  ('Wire Transfer In', 'TRANSFER_IN_WIRE'),
  ('Other Transfer In', 'TRANSFER_IN_OTHER_TRANSFER_IN'),
  
  -- TRANSFER_OUT
  ('Account Transfer Out', 'TRANSFER_OUT_ACCOUNT_TRANSFER'),
  ('Investment and Retirement Funds Out', 'TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS'),
  ('Savings Out', 'TRANSFER_OUT_SAVINGS'),
  ('Wire Transfer Out', 'TRANSFER_OUT_WIRE'),
  ('Withdrawal', 'TRANSFER_OUT_WITHDRAWAL'),
  ('Other Transfer Out', 'TRANSFER_OUT_OTHER_TRANSFER_OUT'),
  
  -- BANK_FEES
  ('Atm Fees', 'BANK_FEES_ATM_FEES'),
  ('Insufficient Funds', 'BANK_FEES_INSUFFICIENT_FUNDS'),
  ('Interest Charge', 'BANK_FEES_INTEREST_CHARGE'),
  ('Foreign Transaction Fees', 'BANK_FEES_FOREIGN_TRANSACTION_FEES'),
  ('Overdraft Fees', 'BANK_FEES_OVERDRAFT_FEES'),
  ('Late Fees', 'BANK_FEES_LATE_FEES'),
  ('Cash Advance Fee', 'BANK_FEES_CASH_ADVANCE'),
  ('Other Bank Fees', 'BANK_FEES_OTHER_BANK_FEES'),
  
  -- ENTERTAINMENT
  ('Casinos and Gambling', 'ENTERTAINMENT_CASINOS_AND_GAMBLING'),
  ('Music and Audio', 'ENTERTAINMENT_MUSIC_AND_AUDIO'),
  ('Sporting Events Amusement Parks and Museums', 'ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS'),
  ('Tv and Movies', 'ENTERTAINMENT_TV_AND_MOVIES'),
  ('Video Games', 'ENTERTAINMENT_VIDEO_GAMES'),
  ('Other Entertainment', 'ENTERTAINMENT_OTHER_ENTERTAINMENT'),
  
  -- FOOD_AND_DRINK
  ('Beer Wine and Liquor', 'FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR'),
  ('Coffee', 'FOOD_AND_DRINK_COFFEE'),
  ('Fast Food', 'FOOD_AND_DRINK_FAST_FOOD'),
  ('Groceries', 'FOOD_AND_DRINK_GROCERIES'),
  ('Restaurant', 'FOOD_AND_DRINK_RESTAURANT'),
  ('Vending Machines', 'FOOD_AND_DRINK_VENDING_MACHINES'),
  ('Other Food and Drink', 'FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK'),
  
  -- GENERAL_MERCHANDISE
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
  ('Other General Merchandise', 'GENERAL_MERCHANDISE_OTHER_GENERAL_MERCHANDISE'),
  
  -- HOME_IMPROVEMENT
  ('Furniture', 'HOME_IMPROVEMENT_FURNITURE'),
  ('Hardware', 'HOME_IMPROVEMENT_HARDWARE'),
  ('Repair and Maintenance', 'HOME_IMPROVEMENT_REPAIR_AND_MAINTENANCE'),
  ('Security', 'HOME_IMPROVEMENT_SECURITY'),
  ('Other Home Improvement', 'HOME_IMPROVEMENT_OTHER_HOME_IMPROVEMENT'),
  
  -- MEDICAL
  ('Dental Care', 'MEDICAL_DENTAL_CARE'),
  ('Eye Care', 'MEDICAL_EYE_CARE'),
  ('Nursing Care', 'MEDICAL_NURSING_CARE'),
  ('Pharmacies and Supplements', 'MEDICAL_PHARMACIES_AND_SUPPLEMENTS'),
  ('Primary Care', 'MEDICAL_PRIMARY_CARE'),
  ('Veterinary Services', 'MEDICAL_VETERINARY_SERVICES'),
  ('Other Medical', 'MEDICAL_OTHER_MEDICAL'),
  
  -- PERSONAL_CARE
  ('Gyms and Fitness Centers', 'PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS'),
  ('Hair and Beauty', 'PERSONAL_CARE_HAIR_AND_BEAUTY'),
  ('Laundry and Dry Cleaning', 'PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING'),
  ('Other Personal Care', 'PERSONAL_CARE_OTHER_PERSONAL_CARE'),
  
  -- GENERAL_SERVICES
  ('Accounting and Financial Planning', 'GENERAL_SERVICES_ACCOUNTING_AND_FINANCIAL_PLANNING'),
  ('Automotive', 'GENERAL_SERVICES_AUTOMOTIVE'),
  ('Childcare', 'GENERAL_SERVICES_CHILDCARE'),
  ('Consulting and Legal', 'GENERAL_SERVICES_CONSULTING_AND_LEGAL'),
  ('Education', 'GENERAL_SERVICES_EDUCATION'),
  ('Insurance', 'GENERAL_SERVICES_INSURANCE'),
  ('Postage and Shipping', 'GENERAL_SERVICES_POSTAGE_AND_SHIPPING'),
  ('Storage', 'GENERAL_SERVICES_STORAGE'),
  ('Other General Services', 'GENERAL_SERVICES_OTHER_GENERAL_SERVICES'),
  
  -- GOVERNMENT_AND_NON_PROFIT
  ('Donations', 'GOVERNMENT_AND_NON_PROFIT_DONATIONS'),
  ('Government Departments and Agencies', 'GOVERNMENT_AND_NON_PROFIT_GOVERNMENT_DEPARTMENTS_AND_AGENCIES'),
  ('Tax Payment', 'GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT'),
  ('Other Government and Non Profit', 'GOVERNMENT_AND_NON_PROFIT_OTHER_GOVERNMENT_AND_NON_PROFIT'),
  
  -- TRANSPORTATION
  ('Bikes and Scooters', 'TRANSPORTATION_BIKES_AND_SCOOTERS'),
  ('Gas', 'TRANSPORTATION_GAS'),
  ('Parking', 'TRANSPORTATION_PARKING'),
  ('Public Transit', 'TRANSPORTATION_PUBLIC_TRANSIT'),
  ('Taxis and Ride Shares', 'TRANSPORTATION_TAXIS_AND_RIDE_SHARES'),
  ('Tolls', 'TRANSPORTATION_TOLLS'),
  ('Other Transportation', 'TRANSPORTATION_OTHER_TRANSPORTATION'),
  
  -- TRAVEL
  ('Flights', 'TRAVEL_FLIGHTS'),
  ('Lodging', 'TRAVEL_LODGING'),
  ('Rental Cars', 'TRAVEL_RENTAL_CARS'),
  ('Other Travel', 'TRAVEL_OTHER_TRAVEL'),
  
  -- RENT_AND_UTILITIES
  ('Gas and Electricity', 'RENT_AND_UTILITIES_GAS_AND_ELECTRICITY'),
  ('Internet and Cable', 'RENT_AND_UTILITIES_INTERNET_AND_CABLE'),
  ('Rent', 'RENT_AND_UTILITIES_RENT'),
  ('Sewage and Waste Management', 'RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT'),
  ('Telephone', 'RENT_AND_UTILITIES_TELEPHONE'),
  ('Water', 'RENT_AND_UTILITIES_WATER'),
  ('Other Utilities', 'RENT_AND_UTILITIES_OTHER_UTILITIES'),
  
  -- OTHER
  ('Other', 'OTHER_OTHER')
) AS mapping(display_name, plaid_key)
WHERE LOWER(TRIM(sc.label)) = LOWER(mapping.display_name)
  AND sc.plaid_category_key IS NULL;

-- Also update icon_url for existing category_groups that don't have one
UPDATE public.category_groups cg
SET icon_url = mapping.icon_url
FROM (VALUES 
  ('INCOME', 'https://plaid-category-icons.plaid.com/PFC_INCOME.png'),
  ('LOAN_DISBURSEMENTS', 'https://plaid-category-icons.plaid.com/PFC_LOAN_DISBURSEMENTS.png'),
  ('LOAN_PAYMENTS', 'https://plaid-category-icons.plaid.com/PFC_LOAN_PAYMENTS.png'),
  ('TRANSFER_IN', 'https://plaid-category-icons.plaid.com/PFC_TRANSFER_IN.png'),
  ('TRANSFER_OUT', 'https://plaid-category-icons.plaid.com/PFC_TRANSFER_OUT.png'),
  ('BANK_FEES', 'https://plaid-category-icons.plaid.com/PFC_BANK_FEES.png'),
  ('ENTERTAINMENT', 'https://plaid-category-icons.plaid.com/PFC_ENTERTAINMENT.png'),
  ('FOOD_AND_DRINK', 'https://plaid-category-icons.plaid.com/PFC_FOOD_AND_DRINK.png'),
  ('GENERAL_MERCHANDISE', 'https://plaid-category-icons.plaid.com/PFC_GENERAL_MERCHANDISE.png'),
  ('HOME_IMPROVEMENT', 'https://plaid-category-icons.plaid.com/PFC_HOME_IMPROVEMENT.png'),
  ('MEDICAL', 'https://plaid-category-icons.plaid.com/PFC_MEDICAL.png'),
  ('PERSONAL_CARE', 'https://plaid-category-icons.plaid.com/PFC_PERSONAL_CARE.png'),
  ('GENERAL_SERVICES', 'https://plaid-category-icons.plaid.com/PFC_GENERAL_SERVICES.png'),
  ('GOVERNMENT_AND_NON_PROFIT', 'https://plaid-category-icons.plaid.com/PFC_GOVERNMENT_AND_NON_PROFIT.png'),
  ('TRANSPORTATION', 'https://plaid-category-icons.plaid.com/PFC_TRANSPORTATION.png'),
  ('TRAVEL', 'https://plaid-category-icons.plaid.com/PFC_TRAVEL.png'),
  ('RENT_AND_UTILITIES', 'https://plaid-category-icons.plaid.com/PFC_RENT_AND_UTILITIES.png'),
  ('OTHER', 'https://plaid-category-icons.plaid.com/PFC_OTHER.png')
) AS mapping(plaid_key, icon_url)
WHERE cg.plaid_category_key = mapping.plaid_key
  AND cg.icon_url IS NULL;
