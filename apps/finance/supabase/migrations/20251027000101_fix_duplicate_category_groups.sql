-- Fix duplicate category_groups entries and enforce uniqueness by name

begin;

-- 1) Re-point any categories that reference duplicate group IDs (idempotent)
update public.system_categories
set group_id = '350915d9-714b-4fe3-9c15-a8854c329355'
where group_id = '6cf0375e-9ff3-443e-ae84-164ef8c10058';

update public.system_categories
set group_id = 'a13ec283-ea8e-4685-8e1c-9d481dee5ebb'
where group_id = 'bb06e7fc-dd5c-4fea-8477-4a19399dc6af';

-- 2) Remove the duplicate category_groups rows (safe after foreign keys are repointed)
delete from public.category_groups
where id in (
  '6cf0375e-9ff3-443e-ae84-164ef8c10058', -- Bank Fees (duplicate)
  'bb06e7fc-dd5c-4fea-8477-4a19399dc6af'  -- Home Improvement (duplicate)
);

-- 3) Prevent future duplicates by name (case-insensitive)
create unique index if not exists uniq_category_groups_name
on public.category_groups (lower(name));

commit;


