-- Global category tables are shared taxonomy data. Normal authenticated
-- users may read them, but writes must go through service-role/admin paths.

drop policy if exists "Authenticated users can insert category groups" on public.category_groups;
drop policy if exists "Authenticated users can update category groups" on public.category_groups;
drop policy if exists "Authenticated users can delete category groups" on public.category_groups;

drop policy if exists "Service role can insert category groups" on public.category_groups;
create policy "Service role can insert category groups"
  on public.category_groups
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Service role can update category groups" on public.category_groups;
create policy "Service role can update category groups"
  on public.category_groups
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role can delete category groups" on public.category_groups;
create policy "Service role can delete category groups"
  on public.category_groups
  for delete
  using (auth.role() = 'service_role');

drop policy if exists "Authenticated users can insert system categories" on public.system_categories;
drop policy if exists "Authenticated users can update system categories" on public.system_categories;
drop policy if exists "Authenticated users can delete system categories" on public.system_categories;

drop policy if exists "Service role can insert system categories" on public.system_categories;
create policy "Service role can insert system categories"
  on public.system_categories
  for insert
  with check (auth.role() = 'service_role');

drop policy if exists "Service role can update system categories" on public.system_categories;
create policy "Service role can update system categories"
  on public.system_categories
  for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role can delete system categories" on public.system_categories;
create policy "Service role can delete system categories"
  on public.system_categories
  for delete
  using (auth.role() = 'service_role');
