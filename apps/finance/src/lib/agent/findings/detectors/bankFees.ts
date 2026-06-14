import { format, subDays } from "date-fns";
import type { Detector, FindingDraft, TransactionInput } from "../types";

/**
 * Bank fees.
 *
 * Sums the avoidable junk fees a user paid over the trailing year —
 * overdraft, ATM, foreign-transaction, insufficient-funds — and surfaces
 * the total as found money. These are the clearest "you lost this for no
 * good reason" charges: precise (Plaid tags them explicitly), unambiguous,
 * and almost always avoidable with a different account or a heads-up.
 *
 * Interest charges live under the same Plaid primary (BANK_FEES) but are a
 * different story — "you're carrying a balance," handled by the
 * credit-card-interest detector — so they're excluded here.
 */

const FEE_PRIMARY = "BANK_FEES";
// Interest is its own finding (carrying a balance), not an avoidable fee.
const INTEREST_DETAILED = "BANK_FEES_INTEREST_CHARGE";
// Don't surface trivial totals — one $3 ATM fee isn't worth a card.
const MIN_TOTAL = 25;
const WINDOW_DAYS = 365;

// Plaid `detailed` subcategory → friendly label for the breakdown.
const FEE_LABELS: Record<string, string> = {
  BANK_FEES_OVERDRAFT_FEES: "Overdraft fees",
  BANK_FEES_INSUFFICIENT_FUNDS: "Insufficient-funds fees",
  BANK_FEES_ATM_FEES: "ATM fees",
  BANK_FEES_FOREIGN_TRANSACTION_FEES: "Foreign-transaction fees",
  BANK_FEES_OTHER_BANK_FEES: "Other bank fees",
};

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function labelFor(detailed: string | null): string {
  return (detailed && FEE_LABELS[detailed]) || "Other bank fees";
}

export function detectBankFees(
  transactions: TransactionInput[],
  now: Date,
): FindingDraft[] {
  const cutoff = format(subDays(now, WINDOW_DAYS), "yyyy-MM-dd");

  let total = 0;
  let count = 0;
  const byType = new Map<string, number>();

  for (const t of transactions) {
    if (t.category_primary !== FEE_PRIMARY) continue;
    if (t.category_detailed === INTEREST_DETAILED) continue;
    if (!(t.amount < 0)) continue; // a refunded fee shouldn't count against
    if (t.date < cutoff) continue;

    const amt = Math.abs(t.amount);
    total += amt;
    count += 1;
    const label = labelFor(t.category_detailed);
    byType.set(label, (byType.get(label) ?? 0) + amt);
  }

  if (total < MIN_TOTAL) return [];

  // Largest fee bucket first, so the reasoning leads with the worst offender.
  const breakdown = [...byType.entries()].sort((a, b) => b[1] - a[1]);

  return [
    {
      type: "bank_fees",
      severity: "review",
      title: `You've paid ${money(total)} in bank fees this year`,
      summary: `${count} avoidable charge${count === 1 ? "" : "s"} — overdraft, ATM, and the like`,
      body:
        `Over the last 12 months you paid ${money(total)} in bank fees across ` +
        `${count} charge${count === 1 ? "" : "s"}. These are usually avoidable — ` +
        `a fee-free or no-overdraft account would keep most of it.`,
      evidence: {
        total,
        count,
        window_days: WINDOW_DAYS,
        by_type: Object.fromEntries(breakdown),
        reasoning: [
          ...breakdown.map(([label, amt]) => ({
            label,
            value: money(amt),
          })),
          { label: "Total this year", value: money(total), note: `${count} charges` },
        ],
      },
      valueAnnual: Math.round(total),
      subjectId: "bank_fees",
      dedupeKey: "bank_fees",
    },
  ];
}

export const bankFeesDetector: Detector = (ctx) =>
  detectBankFees(ctx.transactions, ctx.now);
