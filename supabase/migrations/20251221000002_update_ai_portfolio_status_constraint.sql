-- Update ai_portfolios status check constraint to include 'initializing' and 'error'
-- These statuses are needed for the portfolio initialization flow

-- Drop the old constraint
alter table public.ai_portfolios 
  drop constraint if exists ai_portfolios_status_check;

-- Add the new constraint with additional statuses
alter table public.ai_portfolios 
  add constraint ai_portfolios_status_check 
  check (status in ('active', 'paused', 'completed', 'initializing', 'error'));

