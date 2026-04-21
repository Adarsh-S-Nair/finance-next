-- Add plaid_category_key columns to category tables for stable Plaid identification
-- These columns store the original Plaid keys (e.g., "RENT_AND_UTILITIES", "RENT_AND_UTILITIES_RENT")

-- Add plaid_category_key to category_groups (stores PRIMARY key like "RENT_AND_UTILITIES")
ALTER TABLE public.category_groups 
  ADD COLUMN IF NOT EXISTS plaid_category_key VARCHAR(100);

-- Add unique constraint for plaid_category_key (allows NULL for custom categories)
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_groups_plaid_key 
  ON public.category_groups (plaid_category_key) 
  WHERE plaid_category_key IS NOT NULL;

-- Add plaid_category_key to system_categories (stores DETAILED key like "RENT_AND_UTILITIES_RENT")
ALTER TABLE public.system_categories 
  ADD COLUMN IF NOT EXISTS plaid_category_key VARCHAR(150);

-- Add unique constraint for plaid_category_key (allows NULL for custom categories)
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_categories_plaid_key 
  ON public.system_categories (plaid_category_key) 
  WHERE plaid_category_key IS NOT NULL;

-- Add icon_url to category_groups for Plaid's official category icons
ALTER TABLE public.category_groups 
  ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Add comments
COMMENT ON COLUMN public.category_groups.plaid_category_key IS 'Plaid PFC primary category key (e.g., RENT_AND_UTILITIES)';
COMMENT ON COLUMN public.category_groups.icon_url IS 'URL to Plaid category icon';
COMMENT ON COLUMN public.system_categories.plaid_category_key IS 'Plaid PFC detailed category key (e.g., RENT_AND_UTILITIES_RENT)';
