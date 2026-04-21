-- Fix duplicate system_categories entries and enforce uniqueness by label + group_id

BEGIN;

-- 1. Identify duplicates and map them to the 'keeper' ID
-- We keep the oldest entry (based on created_at) or the one with the smallest ID as a tiebreaker
CREATE TEMP TABLE duplicate_map AS
SELECT
    dup.id AS delete_id,
    keep.id AS keep_id,
    dup.label
FROM
    public.system_categories dup
JOIN (
    SELECT
        id,
        label,
        group_id,
        ROW_NUMBER() OVER (PARTITION BY label, group_id ORDER BY created_at ASC, id ASC) as rn
    FROM
        public.system_categories
) keep ON dup.label = keep.label AND dup.group_id = keep.group_id
WHERE
    keep.rn = 1 -- The one we keep (row number 1)
    AND dup.id != keep.id; -- The ones we delete (all other rows)

-- 2. Update transactions to point to the 'keeper' ID
-- This ensures no transactions are orphaned when we delete the duplicates
UPDATE public.transactions t
SET category_id = dm.keep_id
FROM duplicate_map dm
WHERE t.category_id = dm.delete_id;

-- 3. Delete the duplicate system categories
DELETE FROM public.system_categories
WHERE id IN (SELECT delete_id FROM duplicate_map);

-- 4. Add a unique constraint to prevent future duplicates
-- This ensures that the combination of label and group_id must be unique
ALTER TABLE public.system_categories
ADD CONSTRAINT system_categories_label_group_id_key UNIQUE (label, group_id);

-- Clean up temp table
DROP TABLE duplicate_map;

COMMIT;
