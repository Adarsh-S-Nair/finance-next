"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import { formatCurrency as formatCurrencyBase } from "../../lib/formatCurrency";

// Returns null (not "—") for missing values so Row/Section can hide cleanly.
const formatCurrency = (amount, currency = "USD") =>
  amount == null
    ? null
    : formatCurrencyBase(Number(amount), true, currency || "USD");

const formatDate = (value) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return null;
  }
};

const formatRate = (rate) => {
  if (rate == null) return null;
  return `${Number(rate).toFixed(2)}%`;
};

function Row({ label, value, sublabel }) {
  if (value == null || value === "" || value === false) return null;
  return (
    <div className="flex items-center justify-between py-2">
      <span className="overline">
        {label}
        {sublabel && (
          <span className="ml-1 text-[10px] font-normal text-[var(--color-muted)]/70">
            {sublabel}
          </span>
        )}
      </span>
      <span className="text-sm text-[var(--color-fg)] tabular-nums">
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }) {
  // Children are <Row> ELEMENTS (always truthy), so checking the elements
  // themselves would always pass. Inspect each Row's `value` prop instead —
  // a Row renders nothing when its value is missing, so a section whose rows
  // are all empty should not render its header either.
  const childArray = Array.isArray(children) ? children : [children];
  const hasContent = childArray.some((child) => {
    const v = child?.props?.value;
    return v != null && v !== "" && v !== false;
  });
  if (!hasContent) return null;
  return (
    <div>
      <div className="overline mb-1">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function CreditDetails({ liability, currency }) {
  const aprs = Array.isArray(liability.details?.aprs) ? liability.details.aprs : [];
  const aprByType = (type) => {
    const match = aprs.find((a) => a?.apr_type === type);
    return match?.apr_percentage ?? null;
  };
  const purchaseApr = liability.interest_rate ?? aprByType("purchase_apr");
  const balanceTransferApr = aprByType("balance_transfer_apr");
  const cashApr = aprByType("cash_apr");

  return (
    <>
      <Section title="Rates">
        <Row label="Purchase APR" value={formatRate(purchaseApr)} />
        <Row label="Balance transfer APR" value={formatRate(balanceTransferApr)} />
        <Row label="Cash advance APR" value={formatRate(cashApr)} />
      </Section>
      <Section title="This statement">
        <Row
          label="Statement balance"
          value={formatCurrency(liability.last_statement_balance, currency)}
        />
        <Row
          label="Minimum payment"
          value={formatCurrency(liability.minimum_payment_amount, currency)}
        />
        <Row
          label="Due"
          value={formatDate(liability.next_payment_due_date)}
        />
        <Row
          label="Statement issued"
          value={formatDate(liability.last_statement_issue_date)}
        />
      </Section>
      <Section title="Last payment">
        <Row
          label="Amount"
          value={formatCurrency(liability.last_payment_amount, currency)}
        />
        <Row label="Date" value={formatDate(liability.last_payment_date)} />
      </Section>
    </>
  );
}

function MortgageDetails({ liability, currency }) {
  const interestRateLabel = (() => {
    const pct = formatRate(liability.interest_rate);
    if (!pct) return null;
    return liability.interest_rate_type
      ? `${pct} ${liability.interest_rate_type}`
      : pct;
  })();
  const escrow = liability.details?.escrow_balance;
  const hasPmi = liability.details?.has_pmi;
  const loanTerm = liability.details?.loan_term;
  const loanType = liability.details?.loan_type_description;

  return (
    <>
      <Section title="Loan">
        <Row label="Interest rate" value={interestRateLabel} />
        <Row label="Loan term" value={loanTerm || null} />
        <Row label="Loan type" value={loanType || null} />
        <Row
          label="Original principal"
          value={formatCurrency(liability.origination_principal_amount, currency)}
        />
        <Row label="Originated" value={formatDate(liability.origination_date)} />
        <Row label="Maturity" value={formatDate(liability.expected_payoff_date)} />
      </Section>
      <Section title="This payment">
        <Row
          label="Monthly payment"
          value={formatCurrency(liability.minimum_payment_amount, currency)}
        />
        <Row label="Due" value={formatDate(liability.next_payment_due_date)} />
        <Row
          label="Last payment"
          value={formatCurrency(liability.last_payment_amount, currency)}
          sublabel={formatDate(liability.last_payment_date) || ""}
        />
      </Section>
      <Section title="Year to date">
        <Row
          label="Interest paid"
          value={formatCurrency(liability.ytd_interest_paid, currency)}
        />
        <Row
          label="Principal paid"
          value={formatCurrency(liability.ytd_principal_paid, currency)}
        />
      </Section>
      <Section title="Escrow & insurance">
        <Row
          label="Escrow balance"
          value={escrow != null ? formatCurrency(escrow, currency) : null}
        />
        <Row label="PMI" value={hasPmi === true ? "Yes" : hasPmi === false ? "No" : null} />
      </Section>
    </>
  );
}

function StudentDetails({ liability, currency }) {
  const loanName = liability.details?.loan_name;
  const repaymentType = liability.details?.repayment_plan?.type;
  const outstandingInterest = liability.details?.outstanding_interest_amount;
  const pslfPaymentsMade = liability.details?.pslf_status?.payments_made;
  const pslfPaymentsRemaining = liability.details?.pslf_status?.payments_remaining;

  return (
    <>
      <Section title="Loan">
        <Row label="Loan name" value={loanName || null} />
        <Row label="Interest rate" value={formatRate(liability.interest_rate)} />
        <Row label="Repayment plan" value={repaymentType || null} />
        <Row
          label="Original principal"
          value={formatCurrency(liability.origination_principal_amount, currency)}
        />
        <Row label="Originated" value={formatDate(liability.origination_date)} />
        <Row
          label="Expected payoff"
          value={formatDate(liability.expected_payoff_date)}
        />
      </Section>
      <Section title="This payment">
        <Row
          label="Minimum payment"
          value={formatCurrency(liability.minimum_payment_amount, currency)}
        />
        <Row label="Due" value={formatDate(liability.next_payment_due_date)} />
        <Row
          label="Last payment"
          value={formatCurrency(liability.last_payment_amount, currency)}
          sublabel={formatDate(liability.last_payment_date) || ""}
        />
      </Section>
      <Section title="Year to date">
        <Row
          label="Interest paid"
          value={formatCurrency(liability.ytd_interest_paid, currency)}
        />
        <Row
          label="Principal paid"
          value={formatCurrency(liability.ytd_principal_paid, currency)}
        />
        <Row
          label="Outstanding interest"
          value={
            outstandingInterest != null
              ? formatCurrency(outstandingInterest, currency)
              : null
          }
        />
      </Section>
      {(pslfPaymentsMade != null || pslfPaymentsRemaining != null) && (
        <Section title="PSLF">
          <Row label="Payments made" value={pslfPaymentsMade ?? null} />
          <Row label="Payments remaining" value={pslfPaymentsRemaining ?? null} />
        </Section>
      )}
    </>
  );
}

// Whether a liability row carries any displayable detail. Some institutions
// (e.g. Robinhood's card) are returned by Plaid's liabilities product but with
// every field null — there's simply nothing to show, so we render a clear note
// instead of a grid of blanks.
function liabilityHasDetail(l) {
  const scalarFields = [
    l.last_payment_amount,
    l.last_payment_date,
    l.last_statement_balance,
    l.last_statement_issue_date,
    l.minimum_payment_amount,
    l.next_payment_due_date,
    l.interest_rate,
    l.origination_date,
    l.origination_principal_amount,
    l.expected_payoff_date,
    l.ytd_interest_paid,
    l.ytd_principal_paid,
  ];
  if (scalarFields.some((v) => v != null)) return true;

  const d = l.details || {};
  if (Array.isArray(d.aprs) && d.aprs.length > 0) return true;
  if (d.escrow_balance != null || d.has_pmi != null || d.loan_term || d.loan_type_description)
    return true;
  if (d.loan_name || d.repayment_plan?.type || d.outstanding_interest_amount != null)
    return true;
  if (d.pslf_status?.payments_made != null || d.pslf_status?.payments_remaining != null)
    return true;
  return false;
}

/**
 * Renders the type-specific liability detail section inside AccountDetails.
 * Fetches the liability row directly via the user-RLS'd supabase client; if
 * the row is missing (account isn't a liability, or sync hasn't run yet)
 * the component renders nothing.
 */
export default function AccountLiabilitySection({ accountId, currency = "USD", institutionName }) {
  const [liability, setLiability] = useState(undefined);

  useEffect(() => {
    if (!accountId) {
      setLiability(undefined);
      return;
    }
    let cancelled = false;
    setLiability(undefined);
    supabase
      .from("liabilities")
      .select("*")
      .eq("account_id", accountId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[AccountLiabilitySection] failed to load liability:", error);
          setLiability(null);
          return;
        }
        setLiability(data ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  if (!liability) return null;

  // Row exists but the institution reported no usable detail — explain rather
  // than show a grid of blanks.
  if (!liabilityHasDetail(liability)) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4">
        <div className="text-sm font-medium text-[var(--color-fg)]">No card details available</div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {institutionName || "This institution"} doesn&apos;t report statement, APR,
          or payment details through Plaid for this account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {liability.kind === "credit" && (
        <CreditDetails liability={liability} currency={currency} />
      )}
      {liability.kind === "mortgage" && (
        <MortgageDetails liability={liability} currency={currency} />
      )}
      {liability.kind === "student" && (
        <StudentDetails liability={liability} currency={currency} />
      )}
    </div>
  );
}
