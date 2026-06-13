export type FindingStatus = "new" | "seen" | "acted" | "dismissed";

export interface ExistingFinding {
  status: FindingStatus;
  value_annual: number | null;
}

// Bring a dismissed/acted finding back only once it gets at least this
// much worse — so a dismissal sticks for the same (or smaller) situation,
// but the agent re-flags something that's become materially more relevant.
const RESURFACE_FACTOR = 1.2;

/**
 * Decide the status to persist for a finding on a sweep.
 *
 * - Brand new → "new".
 * - Already active ("new"/"seen") → left as-is.
 * - Dismissed or acted → stays that way, UNLESS its value has grown ≥20%
 *   since, in which case it re-surfaces as "new". This is what lets a
 *   dismissed-but-still-relevant insight come back on its own when it
 *   matters more, without nagging about an unchanged situation.
 */
export function decideStatus(
  existing: ExistingFinding | undefined,
  newValueAnnual: number | null,
): FindingStatus {
  if (!existing) return "new";
  if (existing.status === "new" || existing.status === "seen") return existing.status;

  const old = existing.value_annual;
  if (
    newValueAnnual != null &&
    old != null &&
    old > 0 &&
    newValueAnnual >= old * RESURFACE_FACTOR
  ) {
    return "new";
  }
  return existing.status;
}
