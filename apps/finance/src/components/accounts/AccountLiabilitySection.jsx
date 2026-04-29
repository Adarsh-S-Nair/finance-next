"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase/client";
import { formatCurrency as formatCurrencyBase } from "../../lib/formatCurrency";

const formatCurrency = (amount, currency = "USD") =>
  amount == null
    ? "—"
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
      <span className="card-header">
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
  // Only render the section if at least one child slot is non-null.
  const hasContent = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);
  if (!hasContent) return null;
  return (
    <div>
      <div className="card-header mb-1">{title}</div>
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

/**
 * Renders the type-specific liability detail section inside AccountDetails.
 * Fetches the liability row directly via the user-RLS'd supabase client; if
 * the row is missing (account isn't a liability, or sync hasn't run yet)
 * the component renders nothing.
 */
export default function AccountLiabilitySection({ accountId, currency = "USD" }) {
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
