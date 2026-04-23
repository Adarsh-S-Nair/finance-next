-- Rework neon / pastel / over-saturated category colors to muted 600-800
-- range tones that fit a dark dashboard aesthetic. Colors are still chosen
-- to keep hue-family signals (food = warm, transport = cool blues,
-- income = green, etc.) just at a less eye-searing saturation/brightness.

-- system_categories: pastels, 300/400-tone pastels, neon cyan/lime/yellow
UPDATE system_categories SET hex_color = '#e11d48' WHERE label = 'Account Transfer' AND hex_color = '#fb7185';
UPDATE system_categories SET hex_color = '#0d9488' WHERE label = 'Auto Loan Disbursement' AND hex_color = '#99f6e4';
UPDATE system_categories SET hex_color = '#a21caf' WHERE label = 'Automotive' AND hex_color = '#c026d3';
UPDATE system_categories SET hex_color = '#4f46e5' WHERE label = 'Bikes and Scooters' AND hex_color = '#a5b4fc';
UPDATE system_categories SET hex_color = '#be185d' WHERE label = 'Buy Now Pay Later' AND hex_color = '#fecdd3';
UPDATE system_categories SET hex_color = '#7c3aed' WHERE label = 'Cash Advances' AND hex_color = '#ddd6fe';
UPDATE system_categories SET hex_color = '#047857' WHERE label = 'Casinos and Gambling' AND hex_color = '#34d399';
UPDATE system_categories SET hex_color = '#16a34a' WHERE label = 'Clothing and Accessories' AND hex_color = '#22c55e';
UPDATE system_categories SET hex_color = '#7e22ce' WHERE label = 'Credit Card Payment' AND hex_color = '#a855f7';
UPDATE system_categories SET hex_color = '#a21caf' WHERE label = 'Discount Stores' AND hex_color = '#d946ef';
UPDATE system_categories SET hex_color = '#15803d' WHERE label = 'Earned Wage Access' AND hex_color = '#86efac';
UPDATE system_categories SET hex_color = '#65a30d' WHERE label = 'Electronics' AND hex_color = '#84cc16';
UPDATE system_categories SET hex_color = '#15803d' WHERE label = 'Eye Care' AND hex_color = '#22c55e';
UPDATE system_categories SET hex_color = '#047857' WHERE label = 'Furniture' AND hex_color = '#6ee7b7';
UPDATE system_categories SET hex_color = '#dc2626' WHERE label = 'Gas' AND hex_color = '#fca5a5';
UPDATE system_categories SET hex_color = '#3730a3' WHERE label = 'Gas and Electricity' AND hex_color = '#818cf8';
UPDATE system_categories SET hex_color = '#6b21a8' WHERE label = 'Hardware' AND hex_color = '#d8b4fe';
UPDATE system_categories SET hex_color = '#b91c1c' WHERE label = 'Internet and Cable' AND hex_color = '#f87171';
UPDATE system_categories SET hex_color = '#16a34a' WHERE label = 'Investment and Retirement Funds' AND hex_color = '#4ade80';
UPDATE system_categories SET hex_color = '#b45309' WHERE label = 'Mortgage Disbursement' AND hex_color = '#fcd34d';
UPDATE system_categories SET hex_color = '#9333ea' WHERE label = 'Music and Audio' AND hex_color = '#c084fc';
UPDATE system_categories SET hex_color = '#b45309' WHERE label = 'Nursing Care' AND hex_color = '#f59e0b';
UPDATE system_categories SET hex_color = '#b91c1c' WHERE label = 'Office Supplies' AND hex_color = '#ef4444';
UPDATE system_categories SET hex_color = '#64748b' WHERE label = 'Other' AND hex_color = '#ef4444';
UPDATE system_categories SET hex_color = '#0284c7' WHERE label = 'Other Disbursement' AND hex_color = '#7dd3fc';
UPDATE system_categories SET hex_color = '#0891b2' WHERE label = 'Other Entertainment' AND hex_color = '#22d3ee';
UPDATE system_categories SET hex_color = '#155e75' WHERE label = 'Other Home Improvement' AND hex_color = '#67e8f9';
UPDATE system_categories SET hex_color = '#be185d' WHERE label = 'Other Payment' AND hex_color = '#ec4899';
UPDATE system_categories SET hex_color = '#b45309' WHERE label = 'Other Transfer in' AND hex_color = '#fbbf24';
UPDATE system_categories SET hex_color = '#115e59' WHERE label = 'Other Transportation' AND hex_color = '#86efac';
UPDATE system_categories SET hex_color = '#a16207' WHERE label = 'Other Utilities' AND hex_color = '#6ee7b7';
UPDATE system_categories SET hex_color = '#075985' WHERE label = 'Parking' AND hex_color = '#f9a8d4';
UPDATE system_categories SET hex_color = '#b45309' WHERE label = 'Personal Loan Disbursement' AND hex_color = '#f0abfc';
UPDATE system_categories SET hex_color = '#be185d' WHERE label = 'Pharmacies and Supplements' AND hex_color = '#d946ef';
UPDATE system_categories SET hex_color = '#e11d48' WHERE label = 'Primary Care' AND hex_color = '#84cc16';
UPDATE system_categories SET hex_color = '#0284c7' WHERE label = 'Public Transit' AND hex_color = '#7dd3fc';
UPDATE system_categories SET hex_color = '#a16207' WHERE label = 'Rent' AND hex_color = '#f9a8d4';
UPDATE system_categories SET hex_color = '#047857' WHERE label = 'Rental' AND hex_color = '#a855f7';
UPDATE system_categories SET hex_color = '#a16207' WHERE label = 'Repair and Maintenance' AND hex_color = '#fde047';
UPDATE system_categories SET hex_color = '#9a3412' WHERE label = 'Restaurant' AND hex_color = '#60a5fa';
UPDATE system_categories SET hex_color = '#0e7490' WHERE label = 'Savings' AND hex_color = '#38bdf8';
UPDATE system_categories SET hex_color = '#075985' WHERE label = 'Security' AND hex_color = '#f9a8d4';
UPDATE system_categories SET hex_color = '#854d0e' WHERE label = 'Sewage and Waste Management' AND hex_color = '#67e8f9';
UPDATE system_categories SET hex_color = '#6b21a8' WHERE label = 'Sporting Events Amusement Parks and Museums' AND hex_color = '#facc15';
UPDATE system_categories SET hex_color = '#c2410c' WHERE label = 'Student Loan Disbursement' AND hex_color = '#bef264';
UPDATE system_categories SET hex_color = '#9a3412' WHERE label = 'Superstores' AND hex_color = '#ea580c';
UPDATE system_categories SET hex_color = '#075985' WHERE label = 'Telephone' AND hex_color = '#93c5fd';
UPDATE system_categories SET hex_color = '#1e40af' WHERE label = 'Transfer in from Apps' AND hex_color = '#e879f9';
UPDATE system_categories SET hex_color = '#86198f' WHERE label = 'Tv and Movies' AND hex_color = '#f472b6';
UPDATE system_categories SET hex_color = '#b45309' WHERE label = 'Vending Machines' AND hex_color = '#fb923c';
UPDATE system_categories SET hex_color = '#6b21a8' WHERE label = 'Video Games' AND hex_color = '#2dd4bf';
UPDATE system_categories SET hex_color = '#92400e' WHERE label = 'Water' AND hex_color = '#fdba74';
UPDATE system_categories SET hex_color = '#166534' WHERE label = 'Wire Transfer In' AND hex_color = '#a3e635';

-- category_groups: shift 500-tone (slightly too vivid) to 700 equivalents
UPDATE category_groups SET hex_color = '#475569' WHERE name = 'Bank Fees' AND hex_color = '#ef4444';
UPDATE category_groups SET hex_color = '#7e22ce' WHERE name = 'Entertainment' AND hex_color = '#a855f7';
UPDATE category_groups SET hex_color = '#9a3412' WHERE name = 'Food and Drink' AND hex_color = '#f97316';
UPDATE category_groups SET hex_color = '#be185d' WHERE name = 'General Merchandise' AND hex_color = '#ec4899';
UPDATE category_groups SET hex_color = '#5b21b6' WHERE name = 'General Services' AND hex_color = '#8b5cf6';
UPDATE category_groups SET hex_color = '#0e7490' WHERE name = 'Government and Non Profit' AND hex_color = '#06b6d4';
UPDATE category_groups SET hex_color = '#0369a1' WHERE name = 'Home Improvement' AND hex_color = '#0ea5e9';
UPDATE category_groups SET hex_color = '#047857' WHERE name = 'Income' AND hex_color = '#10b981';
UPDATE category_groups SET hex_color = '#b45309' WHERE name = 'Loan Disbursements' AND hex_color = '#f59e0b';
UPDATE category_groups SET hex_color = '#0f766e' WHERE name = 'Loan Payments' AND hex_color = '#14b8a6';
UPDATE category_groups SET hex_color = '#be123c' WHERE name = 'Medical' AND hex_color = '#f43f5e';
UPDATE category_groups SET hex_color = '#a21caf' WHERE name = 'Personal Care' AND hex_color = '#d946ef';
UPDATE category_groups SET hex_color = '#a16207' WHERE name = 'Rent and Utilities' AND hex_color = '#eab308';
UPDATE category_groups SET hex_color = '#1d4ed8' WHERE name = 'Transfer In' AND hex_color = '#3b82f6';
UPDATE category_groups SET hex_color = '#4338ca' WHERE name = 'Transfer Out' AND hex_color = '#6366f1';
