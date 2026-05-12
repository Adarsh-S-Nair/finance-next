-- Tag each system category with the sign of transaction it applies to:
--   'income'  → only positive amounts (salary, refunds, transfers in, loan disbursements)
--   'expense' → only negative amounts (most spending categories)
--   'both'    → either sign (LOAN_PAYMENTS — credit card payments appear on both
--                legs of the same transfer; OTHER — generic fallback)
ALTER TABLE public.system_categories
  ADD COLUMN direction text NOT NULL DEFAULT 'expense'
    CHECK (direction IN ('income','expense','both'));

-- Backfill by group. Groups not explicitly listed keep the default 'expense'.
UPDATE public.system_categories AS sc
SET direction = 'income'
FROM public.category_groups AS cg
WHERE sc.group_id = cg.id
  AND cg.plaid_category_key IN ('INCOME','TRANSFER_IN','LOAN_DISBURSEMENTS');

UPDATE public.system_categories AS sc
SET direction = 'both'
FROM public.category_groups AS cg
WHERE sc.group_id = cg.id
  AND cg.plaid_category_key IN ('LOAN_PAYMENTS','OTHER');

-- New "Refund" category under INCOME. Used when Plaid classifies a positive
-- amount with an expense PFC (e.g. a Taco Bell refund still comes back as
-- FOOD_AND_DRINK_FAST_FOOD). The sync layer reroutes those rows here so the
-- direction check below doesn't reject them.
INSERT INTO public.system_categories (label, plaid_category_key, group_id, direction)
SELECT 'Refund', NULL, id, 'income'
FROM public.category_groups
WHERE plaid_category_key = 'INCOME'
  AND NOT EXISTS (
    SELECT 1 FROM public.system_categories sc
    WHERE sc.label = 'Refund' AND sc.group_id = category_groups.id
  );

-- One-time cleanup: re-route the small number of historical refunds
-- (positive amount currently sitting in an expense-direction category) to
-- the new Refund category so the trigger we're about to add doesn't fire
-- on legitimate existing data.
WITH refund_cat AS (
  SELECT sc.id FROM public.system_categories sc
  JOIN public.category_groups cg ON cg.id = sc.group_id
  WHERE sc.label = 'Refund' AND cg.plaid_category_key = 'INCOME'
  LIMIT 1
)
UPDATE public.transactions t
SET category_id = (SELECT id FROM refund_cat)
FROM public.system_categories sc
WHERE t.category_id = sc.id
  AND t.amount > 0
  AND sc.direction = 'expense';

-- Validation trigger. Blocks any insert/update that would assign a category
-- whose direction conflicts with the transaction's amount sign. Direction
-- 'both' is always allowed; zero-amount and null-category rows are skipped.
CREATE OR REPLACE FUNCTION public.validate_transaction_category_direction()
RETURNS TRIGGER AS $$
DECLARE
  cat_direction text;
BEGIN
  IF NEW.category_id IS NULL OR NEW.amount = 0 THEN
    RETURN NEW;
  END IF;

  SELECT direction INTO cat_direction
  FROM public.system_categories
  WHERE id = NEW.category_id;

  IF cat_direction IS NULL OR cat_direction = 'both' THEN
    RETURN NEW;
  END IF;

  IF NEW.amount < 0 AND cat_direction = 'income' THEN
    RAISE EXCEPTION
      'Cannot assign an income category to a negative-amount transaction (amount: %)', NEW.amount
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.amount > 0 AND cat_direction = 'expense' THEN
    RAISE EXCEPTION
      'Cannot assign an expense category to a positive-amount transaction (amount: %)', NEW.amount
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS transactions_validate_category_direction ON public.transactions;
CREATE TRIGGER transactions_validate_category_direction
  BEFORE INSERT OR UPDATE OF category_id, amount ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_transaction_category_direction();

COMMENT ON COLUMN public.system_categories.direction IS
  'Sign of transactions allowed in this category: income (positive only), expense (negative only), both (either).';
