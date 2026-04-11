-- Fix case-insensitive duplicate system_categories
-- e.g. "Music and Audio" vs "Music And Audio" in the same group

BEGIN;

-- 1. Find case-insensitive duplicates, keep the oldest entry
CREATE TEMP TABLE ci_duplicate_map AS
SELECT
    dup.id AS delete_id,
    keep.id AS keep_id
FROM public.system_categories dup
JOIN (
    SELECT DISTINCT ON (lower(label), group_id)
        id, label, group_id
    FROM public.system_categories
    ORDER BY lower(label), group_id, created_at ASC, id ASC
) keep ON lower(dup.label) = lower(keep.label) AND dup.group_id = keep.group_id
WHERE dup.id != keep.id;

-- 2. Reassign transactions from duplicates to keepers
UPDATE public.transactions t
SET category_id = dm.keep_id
FROM ci_duplicate_map dm
WHERE t.category_id = dm.delete_id;

-- 3. Delete the duplicate categories
DELETE FROM public.system_categories
WHERE id IN (SELECT delete_id FROM ci_duplicate_map);

-- 4. Drop old case-sensitive constraint, replace with case-insensitive index
ALTER TABLE public.system_categories
DROP CONSTRAINT IF EXISTS system_categories_label_group_id_key;

CREATE UNIQUE INDEX system_categories_label_group_id_ci_key
ON public.system_categories (lower(label), group_id);

DROP TABLE ci_duplicate_map;

COMMIT;
