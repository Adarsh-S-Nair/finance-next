-- Persist the user's chosen monthly income estimate. Set in the budget
-- creation flow (IncomeStep) when the user confirms which months to include
-- in the average; used by the budgets page as the source of truth instead
-- of recomputing on every visit.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS monthly_income NUMERIC;
