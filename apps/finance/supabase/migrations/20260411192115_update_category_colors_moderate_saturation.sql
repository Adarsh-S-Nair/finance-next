-- Update system_categories with moderately saturated colors
-- Balanced between the old neon-bright and the current too-muted palette
-- HSL saturation ~40-55%, lightness ~50-60%

DO $$
DECLARE
  palette TEXT[] := ARRAY[
    '#5b8db8', '#c4956a', '#5a9e7a', '#9b7bb8', '#6aadad',
    '#d4a05a', '#7a7cb8', '#7ab87a', '#c47a8a', '#5aaac4',
    '#b89a5a', '#5ab89a', '#b87aad', '#7ab85a', '#c47a7a',
    '#5aaab8', '#d4a870', '#8a7ab8', '#7ac47a', '#c4887a',
    '#5a8dc4', '#c4a070', '#5aad8a', '#a87ab8', '#70b8b8',
    '#d4985a', '#7a80c4', '#80c47a', '#c47a94', '#5ab4c4',
    '#b8945a', '#5ac4a0', '#b87ab8', '#80c45a', '#c48070',
    '#5a94d4', '#c4a880', '#6aad94', '#a080c4', '#70c4ad',
    '#d49060', '#8080c4', '#80c480', '#c4708a', '#5aadd4',
    '#b8a060', '#60c4a0', '#b880b8', '#8ac460', '#c48870',
    '#5a8ad4', '#c4a070', '#5aad80', '#a878c4', '#60b8c4',
    '#d4a060', '#7880c4', '#78c480', '#c47890', '#58b0d4',
    '#b89860', '#58c498', '#b878b8', '#88c458', '#c48878',
    '#5890d4', '#c4a878', '#58b090', '#a078c4', '#68c4b0',
    '#d49858', '#7878c4', '#78c488', '#c47888', '#58a8d4',
    '#b8a058', '#58c4a8', '#b078c4', '#80c858', '#c49078',
    '#5888d4', '#c4a078', '#58b088', '#9878c4', '#68bcc4',
    '#d49058', '#8078c4', '#80c490', '#c47080', '#58b8d4',
    '#b89858', '#58c4a0', '#b880c4', '#88c868', '#c49880',
    '#5080d4', '#c4a880', '#50b098', '#a080c4', '#60c4b8',
    '#d4a068', '#7880c4', '#78c898', '#c47888', '#50b0d4',
    '#b8a068', '#60c4a8', '#b078c4', '#88c860', '#c49070',
    '#5088d4', '#c4a070', '#50a890', '#9880c4', '#68c4b8',
    '#d49868', '#8078c4', '#80c890', '#c47880', '#58b8d4'
  ];
  rec RECORD;
  idx INT := 0;
BEGIN
  FOR rec IN
    SELECT id FROM public.system_categories
    ORDER BY group_id, label
  LOOP
    UPDATE public.system_categories
    SET hex_color = palette[(idx % array_length(palette, 1)) + 1]
    WHERE id = rec.id;
    idx := idx + 1;
  END LOOP;
END $$;

-- Update category_groups with matching moderate colors
UPDATE category_groups SET hex_color = v.new_color
FROM (VALUES
  ('INCOME', '#5b8db8'),
  ('LOAN_DISBURSEMENTS', '#c4956a'),
  ('LOAN_PAYMENTS', '#5a9e7a'),
  ('TRANSFER_IN', '#9b7bb8'),
  ('TRANSFER_OUT', '#6aadad'),
  ('BANK_FEES', '#d4a05a'),
  ('ENTERTAINMENT', '#7a7cb8'),
  ('FOOD_AND_DRINK', '#7ab87a'),
  ('GENERAL_MERCHANDISE', '#c47a8a'),
  ('HOME_IMPROVEMENT', '#5aaac4'),
  ('MEDICAL', '#b89a5a'),
  ('PERSONAL_CARE', '#5ab89a'),
  ('GENERAL_SERVICES', '#b87aad'),
  ('GOVERNMENT_AND_NON_PROFIT', '#7ab85a'),
  ('TRANSPORTATION', '#c47a7a'),
  ('TRAVEL', '#5aaab8'),
  ('RENT_AND_UTILITIES', '#d4a870'),
  ('OTHER', '#8a7ab8')
) AS v(plaid_key, new_color)
WHERE category_groups.plaid_category_key = v.plaid_key;
