export type FindingStatus = "new" | "seen" | "acted" | "dismissed" | "resolved";

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
 * - Resolved (the situation had cleared) but detected again → "new". The
 *   condition genuinely came back; the user never said "no thanks", so
 *   there's no gate — it's a fresh occurrence.
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
  if (existing.status === "resolved") return "new";

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

export interface ExistingFindingKey {
  dedupe_key: string;
  status: FindingStatus;
}

/**
 * The other half of an idempotent sweep: which currently-active findings
 * should be resolved because their detector no longer fires.
 *
 * A finding is written when its condition holds, but the sweep only ever
 * upserts what it *currently* detects — so a flag whose situation has since
 * cleared (e.g. idle cash after the cash was moved) would otherwise linger
 * forever. This returns the dedupe_keys of active ("new"/"seen") findings
 * that weren't produced this sweep, so the caller can mark them resolved.
 *
 * Terminal user states (acted/dismissed) and already-resolved rows are left
 * untouched — only the agent's own active flags get auto-resolved.
 */
export function selectStaleKeys(
  existing: ExistingFindingKey[],
  detectedKeys: Set<string>,
): string[] {
  return existing
    .filter(
      (r) =>
        (r.status === "new" || r.status === "seen") &&
        !detectedKeys.has(r.dedupe_key),
    )
    .map((r) => r.dedupe_key);
}
