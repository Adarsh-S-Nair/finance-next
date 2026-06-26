import type { Detector, FindingDraft } from "../types";
import { paycheckAnomaly, type IncomeProfile } from "../../../income/detect";

/**
 * Income anomaly — the assistant noticing your paycheck came in off.
 *
 * Reads the detected income profile (primary paycheck) and flags when the
 * most recent deposit deviates materially from the usual amount: a missed
 * bonus, unpaid time off, a deduction change, or a welcome bump. Only fires
 * on a confident, regular paycheck so we don't cry wolf on lumpy income,
 * and keys on the pay date so a single odd cheque surfaces once, not nightly.
 */

// Don't flag anomalies on a shaky/irregular detection.
const MIN_CONFIDENCE = 0.6;
// How far off counts as worth surfacing. Higher than the raw anomaly floor
// so normal paycheck jitter (overtime, hours) stays quiet.
const ANOMALY_THRESHOLD = 0.2;

function whole(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function detectIncomeAnomaly(
  profile: IncomeProfile | null | undefined,
): FindingDraft[] {
  const stream = profile?.primary;
  if (!stream || stream.confidence < MIN_CONFIDENCE) return [];

  const anomaly = paycheckAnomaly(stream, ANOMALY_THRESHOLD);
  if (!anomaly) return [];

  const pctLabel = `${Math.round(anomaly.pct * 100)}%`;
  const dirWord = anomaly.direction;
  const employer = stream.label;

  return [
    {
      type: "income_anomaly",
      severity: "review",
      title: `Your latest paycheck was ${pctLabel} ${dirWord} than usual`,
      summary: `${employer} paid $${whole(anomaly.actual)} vs your usual ~$${whole(anomaly.expected)}`,
      body:
        `Your most recent deposit from ${employer} on ${stream.lastDate} was ` +
        `$${whole(anomaly.actual)} — about ${pctLabel} ${dirWord} than your typical ` +
        `~$${whole(anomaly.expected)}. ` +
        (anomaly.direction === "lower"
          ? "Worth a look for a missed bonus, unpaid time off, or a deduction change."
          : "Likely a bonus or retro pay."),
      evidence: {
        employer,
        expected: anomaly.expected,
        actual: anomaly.actual,
        deviation_pct: anomaly.pct,
        direction: anomaly.direction,
        last_date: stream.lastDate,
        cadence: stream.cadence,
        reasoning: [
          {
            label: "Latest paycheck",
            value: `$${whole(anomaly.actual)}`,
            note: stream.lastDate,
          },
          {
            label: "Your usual",
            value: `~$${whole(anomaly.expected)}`,
            note: "median of recent paychecks",
          },
          { label: "Difference", value: `${pctLabel} ${dirWord}` },
        ],
      },
      valueAnnual: null,
      subjectId: stream.key,
      // Per-paycheck key: one finding per anomalous deposit, not nightly.
      dedupeKey: `income_anomaly:${stream.key}:${stream.lastDate}`,
    },
  ];
}

export const incomeAnomalyDetector: Detector = (ctx) =>
  detectIncomeAnomaly(ctx.incomeProfile);
