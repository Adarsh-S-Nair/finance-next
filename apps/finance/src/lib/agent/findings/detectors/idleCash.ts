import type { AccountInput, Detector, FindingDraft } from "../types";

/**
 * Idle cash.
 *
 * Flags a large balance parked in a checking account, where it earns
 * little to nothing. Checking only — savings accounts are presumed to
 * already earn yield, so flagging them would be wrong. We don't have
 * the account's real APY from Plaid, so the value is an estimate: what
 * the balance would earn in a ~4% high-yield savings account.
 */

// More than a normal spending buffer sitting idle in checking.
const IDLE_THRESHOLD = 10000;
// Representative high-yield savings rate, for the "left on the table" estimate.
const HYSA_RATE = 0.04;

function whole(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function detectIdleCash(accounts: AccountInput[]): FindingDraft[] {
  const findings: FindingDraft[] = [];

  for (const a of accounts) {
    if ((a.subtype ?? "") !== "checking") continue;
    const balance = Number(a.balance);
    if (!(balance >= IDLE_THRESHOLD)) continue;

    const annual = Math.round(balance * HYSA_RATE);

    findings.push({
      type: "idle_cash",
      severity: "review",
      title: `$${whole(balance)} sitting in ${a.name}`,
      summary: `Move it to high-yield savings to earn about $${whole(annual)}/yr`,
      body:
        `You're holding $${whole(balance)} in ${a.name}, a checking account. ` +
        `In a high-yield savings account at ~4% that's about $${whole(annual)}/yr ` +
        `in interest you're not earning.`,
      evidence: {
        account_id: a.id,
        account_name: a.name,
        balance,
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

export const idleCashDetector: Detector = (ctx) => detectIdleCash(ctx.accounts);
