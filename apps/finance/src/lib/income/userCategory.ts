/**
 * Reconcile Plaid's category with the user's manual correction.
 *
 * Income detection keys off Plaid's `personal_finance_category`, but when a
 * user has explicitly re-categorised a transaction in-app (e.g. marking a
 * "WI DEPT REVENUE" deposit Plaid tagged INCOME_SALARY as "Tax Refund"),
 * that correction is the ground truth and must win. This maps the user's
 * chosen category back onto the Plaid-style (primary, detailed) pair the
 * detector understands, reusing its existing exclusion/stream logic.
 *
 * Only applied when `isUserCategorized` is true — otherwise Plaid's
 * category passes through untouched.
 */

export interface EffectiveCategory {
  primary: string | null;
  detailed: string | null;
}

export function effectiveCategory(params: {
  pfcPrimary: string | null;
  pfcDetailed: string | null;
  isUserCategorized: boolean;
  userLabel: string | null;
  userGroup: string | null;
}): EffectiveCategory {
  const { pfcPrimary, pfcDetailed, isUserCategorized, userLabel, userGroup } =
    params;

  if (!isUserCategorized) {
    return { primary: pfcPrimary, detailed: pfcDetailed };
  }

  const group = (userGroup ?? '').toLowerCase();
  const label = (userLabel ?? '').toLowerCase();

  // User moved it out of the Income group entirely — it's not recurring
  // income. Transfers map to TRANSFER_IN (the detector's excluded bucket);
  // anything else is demoted to OTHER so it's ignored.
  if (group && group !== 'income') {
    if (group.includes('transfer')) {
      return { primary: 'TRANSFER_IN', detailed: pfcDetailed };
    }
    return { primary: 'OTHER', detailed: pfcDetailed };
  }

  // Within Income, map the non-paycheck labels onto Plaid detaileds the
  // detector already handles (tax refund → excluded one-off; interest /
  // dividends → their own non-paycheck streams).
  if (label.includes('tax refund')) {
    return { primary: 'INCOME', detailed: 'INCOME_TAX_REFUND' };
  }
  if (label.includes('interest')) {
    return { primary: 'INCOME', detailed: 'INCOME_INTEREST_EARNED' };
  }
  if (label.includes('dividend')) {
    return { primary: 'INCOME', detailed: 'INCOME_DIVIDENDS' };
  }

  return { primary: pfcPrimary, detailed: pfcDetailed };
}
