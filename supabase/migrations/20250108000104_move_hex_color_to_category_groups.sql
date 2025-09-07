-- Move hex_color column from system_categories to category_groups
-- This migration corrects the schema by moving the color field to the appropriate table

-- Add hex_color column to category_groups table
alter table public.category_groups 
add column if not exists hex_color character varying(7) not null default '#6B7280'::character varying;

-- Add check constraint for hex_color format in category_groups
alter table public.category_groups 
add constraint if not exists category_groups_hex_color_check 
check (hex_color ~ '^#[0-9A-Fa-f]{6}$'::text);

-- Create index for hex_color in category_groups
create index if not exists idx_category_groups_hex_color 
  on public.category_groups using btree (hex_color);

-- Remove hex_color column from system_categories table
alter table public.system_categories 
drop column if exists hex_color;

-- Drop the check constraint from system_categories (if it exists)
alter table public.system_categories 
drop constraint if exists system_categories_hex_color_check;

-- Drop the index from system_categories (if it exists)
drop index if exists idx_system_categories_hex_color;

-- Update comments to reflect the schema changes
comment on column public.category_groups.hex_color is 'Hex color code for UI display of the category group';

-- Remove the old comment from system_categories (the column no longer exists)
-- This is handled automatically when the column is dropped
