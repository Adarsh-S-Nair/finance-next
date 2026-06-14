import { addYears, differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { Detector, FindingDraft, RecurringStreamInput } from "../types";

/**
 * Annual-renewal heads-up.
 *
 * Flags an annual subscription whose next charge is about to land, so a
 * large once-a-year bill ("$120 for that app you forgot about") never
 * catches the user off guard while there's still time to cancel.
 *
 * This is an `info` finding, not money found — the value is the warning,
 * not a quantified saving — so it carries no `valueAnnual`. Scoped to
 * active annual outflows only; monthly subscriptions don't surprise
 * anyone, so they're out of scope here.
 */

// How far ahead to warn. Wide enough to act (cancel before renewal),
// narrow enough that it's genuinely "soon," not background noise.
const LEAD_DAYS = 14;

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function streamName(s: RecurringStreamInput): string {
  return s.merchant_name || s.description || "An annual subscription";
}

/** Next renewal on/after today: last charge + 1yr, advanced if stale. */
function nextRenewal(lastDate: string, today: Date): Date {
  let next = addYears(parseISO(lastDate), 1);
  while (differenceInCalendarDays(next, today) < 0) next = addYears(next, 1);
  return next;
}

export function detectAnnualRenewals(
  streams: RecurringStreamInput[],
  now: Date,
): FindingDraft[] {
  const today = startOfDay(now);
  const findings: FindingDraft[] = [];

  for (const s of streams) {
    if (s.stream_type !== "outflow") continue;
    if (!s.is_active) continue;
    if (s.frequency !== "ANNUALLY") continue;
    if (!s.last_date) continue;

    const amount = Number(s.last_amount) || Number(s.average_amount);
    if (!(amount > 0)) continue;

    const next = nextRenewal(s.last_date, today);
    const daysAway = differenceInCalendarDays(next, today);
    if (daysAway < 0 || daysAway > LEAD_DAYS) continue;

    const name = streamName(s);
    const when =
      daysAway === 0 ? "today" : daysAway === 1 ? "tomorrow" : `in ${daysAway} days`;
    const nextStr = next.toISOString().slice(0, 10);

    findings.push({
      type: "annual_renewal",
      severity: "info",
      title: `${name} renews ${when} — about ${money(amount)}`,
      summary: `Your annual ${name} charge is coming up${
        daysAway > 1 ? " — cancel now if you don't use it" : ""
      }`,
      body:
        `${name} is an annual subscription of about ${money(amount)}, and its next ` +
        `charge lands ${when} (around ${nextStr}). If you're not using it, now's the ` +
        `time to cancel before it renews for another year.`,
      evidence: {
        stream_id: s.stream_id,
        merchant: name,
        amount,
        last_date: s.last_date,
        next_date: nextStr,
        days_away: daysAway,
        reasoning: [
          { label: "Last charged", value: s.last_date },
          { label: "Renews", value: nextStr, note: when },
          { label: "Amount", value: money(amount) },
        ],
      },
      valueAnnual: null,
      subjectId: s.stream_id,
      dedupeKey: `annual_renewal:${s.stream_id}`,
    });
  }

  return findings;
}

export const annualRenewalDetector: Detector = (ctx) =>
  detectAnnualRenewals(ctx.streams, ctx.now);
