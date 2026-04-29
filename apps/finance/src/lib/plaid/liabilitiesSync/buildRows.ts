import type { TablesInsert } from '@zervo/supabase';

/**
 * Pure mapper from Plaid's /liabilities/get response to rows ready for
 * upserting into our `liabilities` table. No IO, no Supabase, no Plaid
 * client — easy to unit-test.
 *
 * Design notes:
 * - One row per liability account (Plaid returns one entry per account
 *   under credit/mortgage/student). Keyed on accounts.id (our internal id).
 * - The 80% common fields (last_payment_*, next_payment_due_date, ...)
 *   are real columns. Type-specific extras live in `details` JSONB.
 * - For credit cards we normalize the purchase APR into the
 *   `interest_rate` column; the full APR list stays in `details.aprs`.
 * - For mortgages we store `next_monthly_payment` in
 *   `minimum_payment_amount` so the column is meaningful for all kinds.
 */

type LiabilityRow = TablesInsert<'liabilities'>;

export type PlaidLiabilitiesResponse = {
  liabilities?: {
    credit?: PlaidCreditLiability[] | null;
    mortgage?: PlaidMortgageLiability[] | null;
    student?: PlaidStudentLiability[] | null;
  } | null;
};

export interface PlaidApr {
  apr_percentage?: number | null;
  apr_type?: string | null;
  balance_subject_to_apr?: number | null;
  interest_charge_amount?: number | null;
}

export interface PlaidCreditLiability {
  account_id: string;
  aprs?: PlaidApr[] | null;
  is_overdue?: boolean | null;
  last_payment_amount?: number | null;
  last_payment_date?: string | null;
  last_statement_issue_date?: string | null;
  last_statement_balance?: number | null;
  minimum_payment_amount?: number | null;
  next_payment_due_date?: string | null;
}

export interface PlaidMortgageLiability {
  account_id: string;
  current_late_fee?: number | null;
  escrow_balance?: number | null;
  has_pmi?: boolean | null;
  has_prepayment_penalty?: boolean | null;
  interest_rate?: { percentage?: number | null; type?: string | null } | null;
  last_payment_amount?: number | null;
  last_payment_date?: string | null;
  loan_term?: string | null;
  loan_type_description?: string | null;
  maturity_date?: string | null;
  next_monthly_payment?: number | null;
  next_payment_due_date?: string | null;
  origination_date?: string | null;
  origination_principal_amount?: number | null;
  past_due_amount?: number | null;
  property_address?: unknown;
  ytd_interest_paid?: number | null;
  ytd_principal_paid?: number | null;
}

export interface PlaidStudentLiability {
  account_id: string;
  expected_payoff_date?: string | null;
  guarantor?: string | null;
  interest_rate_percentage?: number | null;
  is_overdue?: boolean | null;
  last_payment_amount?: number | null;
  last_payment_date?: string | null;
  last_statement_balance?: number | null;
  last_statement_issue_date?: string | null;
  loan_name?: string | null;
  loan_status?: unknown;
  minimum_payment_amount?: number | null;
  next_payment_due_date?: string | null;
  origination_date?: string | null;
  origination_principal_amount?: number | null;
  outstanding_interest_amount?: number | null;
  pslf_status?: unknown;
  repayment_plan?: unknown;
  ytd_interest_paid?: number | null;
  ytd_principal_paid?: number | null;
  disbursement_dates?: string[] | null;
}

export interface BuildContext {
  userId: string;
  /** Plaid `account_id` -> our internal `accounts.id`. */
  accountIdMap: Map<string, string>;
  logger: { warn: (msg: string, data?: Record<string, unknown>) => void };
  /** Stable timestamp used for the synced_at column on every row. */
  syncedAt?: string;
}

export function buildLiabilityRows(
  response: PlaidLiabilitiesResponse,
  ctx: BuildContext,
): LiabilityRow[] {
  const { userId, accountIdMap, logger } = ctx;
  const syncedAt = ctx.syncedAt ?? new Date().toISOString();
  const rows: LiabilityRow[] = [];
  const liabilities = response.liabilities ?? {};

  for (const credit of liabilities.credit ?? []) {
    const accountId = accountIdMap.get(credit.account_id);
    if (!accountId) {
      logger.warn('Credit liability returned for unknown account', {
        plaid_account_id: credit.account_id,
      });
      continue;
    }
    const purchaseApr = (credit.aprs ?? []).find((a) => a.apr_type === 'purchase_apr');
    rows.push({
      account_id: accountId,
      user_id: userId,
      kind: 'credit',
      is_overdue: credit.is_overdue ?? null,
      last_payment_amount: credit.last_payment_amount ?? null,
      last_payment_date: credit.last_payment_date ?? null,
      last_statement_balance: credit.last_statement_balance ?? null,
      last_statement_issue_date: credit.last_statement_issue_date ?? null,
      minimum_payment_amount: credit.minimum_payment_amount ?? null,
      next_payment_due_date: credit.next_payment_due_date ?? null,
      interest_rate: purchaseApr?.apr_percentage ?? null,
      interest_rate_type: null,
      origination_date: null,
      origination_principal_amount: null,
      expected_payoff_date: null,
      ytd_interest_paid: null,
      ytd_principal_paid: null,
      details: { aprs: (credit.aprs ?? []) as unknown as never },
      synced_at: syncedAt,
    });
  }

  for (const mortgage of liabilities.mortgage ?? []) {
    const accountId = accountIdMap.get(mortgage.account_id);
    if (!accountId) {
      logger.warn('Mortgage liability returned for unknown account', {
        plaid_account_id: mortgage.account_id,
      });
      continue;
    }
    const pastDue = mortgage.past_due_amount ?? 0;
    rows.push({
      account_id: accountId,
      user_id: userId,
      kind: 'mortgage',
      // Plaid doesn't expose is_overdue directly on mortgages — derive it
      // from past_due_amount > 0 so the UI has a consistent flag.
      is_overdue: pastDue > 0 ? true : pastDue === 0 ? false : null,
      last_payment_amount: mortgage.last_payment_amount ?? null,
      last_payment_date: mortgage.last_payment_date ?? null,
      next_payment_due_date: mortgage.next_payment_due_date ?? null,
      minimum_payment_amount: mortgage.next_monthly_payment ?? null,
      last_statement_balance: null,
      last_statement_issue_date: null,
      interest_rate: mortgage.interest_rate?.percentage ?? null,
      interest_rate_type: mortgage.interest_rate?.type ?? null,
      origination_date: mortgage.origination_date ?? null,
      origination_principal_amount: mortgage.origination_principal_amount ?? null,
      expected_payoff_date: mortgage.maturity_date ?? null,
      ytd_interest_paid: mortgage.ytd_interest_paid ?? null,
      ytd_principal_paid: mortgage.ytd_principal_paid ?? null,
      details: {
        escrow_balance: mortgage.escrow_balance ?? null,
        has_pmi: mortgage.has_pmi ?? null,
        has_prepayment_penalty: mortgage.has_prepayment_penalty ?? null,
        loan_term: mortgage.loan_term ?? null,
        loan_type_description: mortgage.loan_type_description ?? null,
        current_late_fee: mortgage.current_late_fee ?? null,
        past_due_amount: mortgage.past_due_amount ?? null,
        property_address: (mortgage.property_address ?? null) as unknown as never,
      },
      synced_at: syncedAt,
    });
  }

  for (const student of liabilities.student ?? []) {
    const accountId = accountIdMap.get(student.account_id);
    if (!accountId) {
      logger.warn('Student loan returned for unknown account', {
        plaid_account_id: student.account_id,
      });
      continue;
    }
    rows.push({
      account_id: accountId,
      user_id: userId,
      kind: 'student',
      is_overdue: student.is_overdue ?? null,
      last_payment_amount: student.last_payment_amount ?? null,
      last_payment_date: student.last_payment_date ?? null,
      last_statement_balance: student.last_statement_balance ?? null,
      last_statement_issue_date: student.last_statement_issue_date ?? null,
      minimum_payment_amount: student.minimum_payment_amount ?? null,
      next_payment_due_date: student.next_payment_due_date ?? null,
      interest_rate: student.interest_rate_percentage ?? null,
      interest_rate_type: null,
      origination_date: student.origination_date ?? null,
      origination_principal_amount: student.origination_principal_amount ?? null,
      expected_payoff_date: student.expected_payoff_date ?? null,
      ytd_interest_paid: student.ytd_interest_paid ?? null,
      ytd_principal_paid: student.ytd_principal_paid ?? null,
      details: {
        pslf_status: (student.pslf_status ?? null) as unknown as never,
        repayment_plan: (student.repayment_plan ?? null) as unknown as never,
        loan_status: (student.loan_status ?? null) as unknown as never,
        outstanding_interest_amount: student.outstanding_interest_amount ?? null,
        loan_name: student.loan_name ?? null,
        guarantor: student.guarantor ?? null,
        disbursement_dates: student.disbursement_dates ?? null,
      },
      synced_at: syncedAt,
    });
  }

  return rows;
}
