-- Revert category colors back to the softer, lower-saturation palette.
-- The moderate-saturation migration (2026-04-11) pushed hues too bright for the
-- app's flat, muted aesthetic. Returning to the original muted palette (HSL
-- saturation ~15-25%, lightness ~60-70%) so category colors blend with the UI.

DO $$
DECLARE
  palette TEXT[] := ARRAY[
    '#8ba3bf', '#b0a090', '#7a9e8e', '#b09aaf', '#9ab3b3',
    '#c4a882', '#8e8faa', '#a3b5a0', '#b5929a', '#8caab5',
    '#a89a82', '#91a8a0', '#b8a3b3', '#9db09a', '#a8949e',
    '#85a6a6', '#bca88e', '#9c97b0', '#a0b392', '#b39a8e',
    '#88a0b8', '#b5a695', '#809e99', '#ae9db5', '#98b5aa',
    '#c0a48a', '#9294ad', '#a7b89e', '#b3909c', '#8eacb8',
    '#ab9d88', '#8fa9a3', '#baa1b0', '#9fb398', '#ab959f',
    '#87a8a9', '#bfab92', '#9f99b3', '#a3b694', '#b69d90',
    '#8ba2bb', '#b8a998', '#829f9b', '#b19fb8', '#9ab7ad',
    '#c2a78d', '#9596b0', '#a9baa1', '#b5929e', '#90aebb',
    '#ae9f8b', '#91aba5', '#bca3b3', '#a1b59b', '#ad97a1',
    '#89aaab', '#c1ad95', '#a19bb5', '#a5b896', '#b89f92',
    '#8da4be', '#baa09c', '#84a19e', '#b3a1bb', '#9cb9b0',
    '#c5aa90', '#9798b3', '#abb89d', '#b7949e', '#92b0be',
    '#b0a18e', '#93ada8', '#bea5b6', '#a3b79e', '#af99a3',
    '#8bacae', '#c3af98', '#a39db8', '#a7ba99', '#ba9f95',
    '#8fa6c0', '#bca29e', '#86a3a0', '#b5a3be', '#9ebbb2',
    '#c7ac93', '#999ab6', '#adba9f', '#b996a0', '#94b2c0',
    '#b2a390', '#95afaa', '#c0a7b8', '#a5b9a0', '#b19ba5',
    '#8daeaf', '#c5b19a', '#a59fba', '#a9bc9b', '#bc9f97',
    '#91a7c2', '#bea4a0', '#88a5a2', '#b7a5c0', '#a0bdb4',
    '#c9ae95', '#9b9cb8', '#afbc9f', '#bb98a2', '#96b4c2',
    '#b4a592', '#97b1ac', '#c2a9ba', '#a7bb9e', '#b39da7',
    '#8fb0b0', '#c7b39c', '#a7a1bc', '#abbe9d', '#be9f99',
    '#93a9c3', '#c0a6a2', '#8aa7a4', '#b9a7c2', '#a2bfb6',
    '#cbaf97', '#9d9eba', '#b1bea1', '#bd9aa4', '#98b6c3',
    '#b6a794', '#99b3ae', '#c4abbc', '#a9bd9e', '#b59fa9',
    '#91b2b2', '#c9b59e', '#a9a3be', '#adc09f', '#c0a19b'
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

-- Sync category_groups back to muted colors too
UPDATE category_groups SET hex_color = v.new_color
FROM (VALUES
  ('INCOME', '#8ba3bf'),
  ('LOAN_DISBURSEMENTS', '#b0a090'),
  ('LOAN_PAYMENTS', '#7a9e8e'),
  ('TRANSFER_IN', '#b09aaf'),
  ('TRANSFER_OUT', '#9ab3b3'),
  ('BANK_FEES', '#c4a882'),
  ('ENTERTAINMENT', '#8e8faa'),
  ('FOOD_AND_DRINK', '#a3b5a0'),
  ('GENERAL_MERCHANDISE', '#b5929a'),
  ('HOME_IMPROVEMENT', '#8caab5'),
  ('MEDICAL', '#a89a82'),
  ('PERSONAL_CARE', '#91a8a0'),
  ('GENERAL_SERVICES', '#b8a3b3'),
  ('GOVERNMENT_AND_NON_PROFIT', '#9db09a'),
  ('TRANSPORTATION', '#a8949e'),
  ('TRAVEL', '#85a6a6'),
  ('RENT_AND_UTILITIES', '#bca88e'),
  ('OTHER', '#9c97b0')
) AS v(plaid_key, new_color)
WHERE category_groups.plaid_category_key = v.plaid_key;
