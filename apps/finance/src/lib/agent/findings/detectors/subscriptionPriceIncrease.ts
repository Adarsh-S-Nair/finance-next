import type { Detector, FindingDraft, RecurringStreamInput } from "../types";

/**
 * Subscription price increase.
 *
 * Flags a fixed-fee subscription whose latest charge is meaningfully
 * higher than its historical average — the canonical "wait, when did
 * that go up?" finding. Scoped to subscription-like Plaid categories so
 * it never fires on transfers, card payments, or variable utility bills
 * (which legitimately fluctuate month to month).
 *
 * Calibrated against real recurring data: Spotify $9.69 → $13.70 (+41%)
 * and Push Fitness $55.14 → $62.00 (+12%) fire; AT&T/Spectrum (utilities)
 * and ACH/loan payments are excluded by category.
 */

// Plaid personal-finance-category primaries that are fixed-fee
// subscriptions. Kept deliberately narrow — precision over recall.
const SUBSCRIPTION_CATEGORIES = new Set(["ENTERTAINMENT", "PERSONAL_CARE"]);

// A real increase, not rounding noise: at least 8% AND at least $1.
const MIN_RATIO = 1.08;
const MIN_DELTA = 1;

const PERIODS_PER_YEAR: Record<string, number> = {
  WEEKLY: 52,
  BIWEEKLY: 26,
  SEMI_MONTHLY: 24,
  MONTHLY: 12,
  ANNUALLY: 1,
};

function annualize(perPeriodDelta: number, frequency: string): number {
  const periods = PERIODS_PER_YEAR[frequency] ?? 12; // assume monthly if unknown
  return perPeriodDelta * periods;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function streamName(s: RecurringStreamInput): string {
  return s.merchant_name || s.description || "A subscription";
}

export function detectSubscriptionPriceIncreases(
  streams: RecurringStreamInput[],
): FindingDraft[] {
  const findings: FindingDraft[] = [];

  for (const s of streams) {
    if (s.stream_type !== "outflow") continue;
    if (!s.is_active) continue;
    if (s.status !== "MATURE") continue; // established history only
    if (!SUBSCRIPTION_CATEGORIES.has(s.category_primary ?? "")) continue;

    const avg = Number(s.average_amount);
    const last = Number(s.last_amount);
    if (!(avg > 0) || !(last > 0)) continue;
    if (last < avg * MIN_RATIO) continue;
    if (last - avg < MIN_DELTA) continue;

    const name = streamName(s);
    const pct = Math.round((last / avg - 1) * 100);
    const annual = Math.round(annualize(last - avg, s.frequency));

    findings.push({
      type: "subscription_price_increase",
      severity: "review",
      title: `${name} went up to ${money(last)}`,
      summary: `Up about ${money(annual)}/yr from the old price`,
      body:
        `Your ${name} charge rose from about ${money(avg)} to ${money(last)} — up ${pct}%. ` +
        `That's roughly ${money(annual)}/yr more if it sticks.`,
      evidence: {
        stream_id: s.stream_id,
        merchant: name,
        frequency: s.frequency,
        average_amount: avg,
        last_amount: last,
        last_date: s.last_date,
        increase_pct: pct,
        reasoning: [
          { label: "Was", value: money(avg), note: "average of past charges" },
          {
            label: "Now",
            value: money(last),
            note: s.last_date ? `latest charge · ${s.last_date}` : "latest charge",
          },
          { label: "Increase", value: `+${pct}%` },
          { label: "Over a year", value: `~${money(annual)}/yr more`, note: "at this frequency" },
        ],
      },
      valueAnnual: annual,
      subjectId: s.stream_id,
      dedupeKey: `subscription_price_increase:${s.stream_id}`,
    });
  }

  return findings;
}

export const subscriptionPriceIncreaseDetector: Detector = (ctx) =>
  detectSubscriptionPriceIncreases(ctx.streams);
