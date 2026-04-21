-- Punch up category color saturation again. The moderate palette was still
-- reading as washed out next to the rest of the UI. This palette uses
-- Tailwind-500/600 style hex values (HSL sat ~60-85%, lightness ~45-55%) so
-- categories have actual visual identity.

DO $$
DECLARE
  palette TEXT[] := ARRAY[
    '#3b82f6', '#f97316', '#10b981', '#a855f7', '#06b6d4',
    '#eab308', '#ec4899', '#14b8a6', '#f43f5e', '#8b5cf6',
    '#22c55e', '#f59e0b', '#0ea5e9', '#d946ef', '#84cc16',
    '#6366f1', '#ef4444', '#059669', '#c026d3', '#0891b2',
    '#2563eb', '#ea580c', '#16a34a', '#9333ea', '#0e7490',
    '#ca8a04', '#be185d', '#0f766e', '#dc2626', '#7c3aed',
    '#1d4ed8', '#c2410c', '#15803d', '#7e22ce', '#075985',
    '#a16207', '#9f1239', '#134e4a', '#991b1b', '#4c1d95',
    '#60a5fa', '#fb923c', '#34d399', '#c084fc', '#22d3ee',
    '#facc15', '#f472b6', '#2dd4bf', '#fb7185', '#a78bfa',
    '#4ade80', '#fbbf24', '#38bdf8', '#e879f9', '#a3e635',
    '#818cf8', '#f87171', '#6ee7b7', '#f9a8d4', '#67e8f9',
    '#93c5fd', '#fdba74', '#6ee7b7', '#d8b4fe', '#67e8f9',
    '#fde047', '#f9a8d4', '#99f6e4', '#fecdd3', '#ddd6fe',
    '#86efac', '#fcd34d', '#7dd3fc', '#f0abfc', '#bef264',
    '#a5b4fc', '#fca5a5', '#86efac', '#f9a8d4', '#7dd3fc',
    '#1e40af', '#9a3412', '#166534', '#6b21a8', '#155e75',
    '#854d0e', '#831843', '#134e4a', '#7f1d1d', '#3730a3',
    '#172554', '#7c2d12', '#14532d', '#581c87', '#164e63',
    '#713f12', '#500724', '#042f2e', '#450a0a', '#312e81'
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

UPDATE category_groups SET hex_color = v.new_color
FROM (VALUES
  ('INCOME', '#10b981'),
  ('LOAN_DISBURSEMENTS', '#f59e0b'),
  ('LOAN_PAYMENTS', '#14b8a6'),
  ('TRANSFER_IN', '#3b82f6'),
  ('TRANSFER_OUT', '#6366f1'),
  ('BANK_FEES', '#ef4444'),
  ('ENTERTAINMENT', '#a855f7'),
  ('FOOD_AND_DRINK', '#f97316'),
  ('GENERAL_MERCHANDISE', '#ec4899'),
  ('HOME_IMPROVEMENT', '#0ea5e9'),
  ('MEDICAL', '#f43f5e'),
  ('PERSONAL_CARE', '#d946ef'),
  ('GENERAL_SERVICES', '#8b5cf6'),
  ('GOVERNMENT_AND_NON_PROFIT', '#06b6d4'),
  ('TRANSPORTATION', '#0284c7'),
  ('TRAVEL', '#0d9488'),
  ('RENT_AND_UTILITIES', '#eab308'),
  ('OTHER', '#6b7280')
) AS v(plaid_key, new_color)
WHERE category_groups.plaid_category_key = v.plaid_key;
