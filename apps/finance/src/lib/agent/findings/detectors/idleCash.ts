import type { AccountInput, Detector, FindingDraft } from "../types";

/**
 * Idle cash — cash-flow aware.
 *
 * Flags the portion of a checking balance that's *more than the user
 * realistically needs on hand*, not the whole balance. We size a buffer
 * from their actual spending (one month of typical outflow) and only
 * surface the excess above it — so the advice respects their cash flow
 * instead of naively telling them to drain their checking account.
 *
 * Checking only (savings is presumed to already earn yield). The APY
 * isn't known from Plaid, so the value is an estimate: what the excess
 * would earn in a ~4% high-yield savings account.
 */

// How much of a checking cushion counts as "needed" — one month of
// typical spending. The emergency fund (months of essentials) is a
// separate, larger cushion that lives in savings, not checking.
const BUFFER_MONTHS = 1;
// Don't nag about small amounts — only surface a meaningful excess.
const MIN_EXCESS = 2000;
const HYSA_RATE = 0.04;

function whole(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function detectIdleCash(
  accounts: AccountInput[],
  monthlySpending: number,
): FindingDraft[] {
  const findings: FindingDraft[] = [];

  // Without a spending estimate we can't size a buffer — don't guess.
  if (!(monthlySpending > 0)) return findings;
  const buffer = monthlySpending * BUFFER_MONTHS;

  for (const a of accounts) {
    if ((a.subtype ?? "") !== "checking") continue;
    const balance = Number(a.balance);
    const excess = balance - buffer;
    if (excess < MIN_EXCESS) continue;

    const annual = Math.round(excess * HYSA_RATE);

    findings.push({
      type: "idle_cash",
      severity: "review",
      title: `$${whole(excess)} of your checking is sitting idle`,
      summary: `Move it to high-yield savings to earn ~$${whole(annual)}/yr`,
      body:
        `You're holding $${whole(balance)} in ${a.name}. You spend about ` +
        `$${whole(monthlySpending)}/mo, so keeping roughly $${whole(buffer)} as a ` +
        `one-month buffer leaves about $${whole(excess)} that could be earning ~4% ` +
        `in a high-yield savings account — around $${whole(annual)}/yr.`,
      evidence: {
        account_id: a.id,
        account_name: a.name,
        balance,
        monthly_spending: monthlySpending,
        buffer,
        excess,
        assumed_apy: HYSA_RATE,
      },
      valueAnnual: annual,
      suggestedAction: { label: "Move to savings" },
      subjectId: a.id,
      dedupeKey: `idle_cash:${a.id}`,
    });
  }

  return findings;
}

export const idleCashDetector: Detector = (ctx) =>
  detectIdleCash(ctx.accounts, ctx.monthlySpending);
