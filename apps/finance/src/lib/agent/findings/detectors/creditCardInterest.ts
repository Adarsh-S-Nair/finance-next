import { format, subDays } from "date-fns";
import type { Detector, FindingDraft, TransactionInput } from "../types";

/**
 * Credit-card interest.
 *
 * Sums interest charged over the trailing year. Interest is the clearest
 * possible signal that a user is carrying a revolving balance — Plaid tags
 * it explicitly (BANK_FEES_INTEREST_CHARGE), so there's no ambiguity — and
 * it's typically the single most expensive, most addressable thing in a
 * personal budget. Paying the balance down beats almost any yield finding.
 *
 * We surface the cost, not a directive: "you paid $X in interest" is a
 * fact; we don't tell the user how to restructure their debt.
 */

const INTEREST_DETAILED = "BANK_FEES_INTEREST_CHARGE";
const MIN_TOTAL = 25;
const WINDOW_DAYS = 365;

function money(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function detectCreditCardInterest(
  transactions: TransactionInput[],
  now: Date,
): FindingDraft[] {
  const cutoff = format(subDays(now, WINDOW_DAYS), "yyyy-MM-dd");

  let total = 0;
  let count = 0;
  let lastDate: string | null = null;

  for (const t of transactions) {
    if (t.category_detailed !== INTEREST_DETAILED) continue;
    if (!(t.amount < 0)) continue;
    if (t.date < cutoff) continue;

    total += Math.abs(t.amount);
    count += 1;
    if (!lastDate || t.date > lastDate) lastDate = t.date;
  }

  if (total < MIN_TOTAL) return [];

  return [
    {
      type: "credit_card_interest",
      severity: "review",
      title: `You paid ${money(total)} in interest this year`,
      summary: `You're likely carrying a balance — paying it down saves the most`,
      body:
        `Over the last 12 months you were charged ${money(total)} in interest across ` +
        `${count} statement${count === 1 ? "" : "s"}. That usually means a balance is ` +
        `carrying month to month — paying it down is typically the highest-return move ` +
        `you can make, well above any savings rate.`,
      evidence: {
        total,
        count,
        window_days: WINDOW_DAYS,
        last_charge: lastDate,
        reasoning: [
          { label: "Interest charged", value: money(total), note: `${count} statements` },
          ...(lastDate ? [{ label: "Most recent", value: lastDate }] : []),
        ],
      },
      valueAnnual: Math.round(total),
      subjectId: "credit_card_interest",
      dedupeKey: "credit_card_interest",
    },
  ];
}

export const creditCardInterestDetector: Detector = (ctx) =>
  detectCreditCardInterest(ctx.transactions, ctx.now);
