/**
 * The findings engine: deterministic detectors that read a user's
 * financial data and emit "findings" — the things the assistant
 * surfaces on the dashboard. Detectors are pure functions over a
 * context object so they're cheap, explainable, and unit-testable;
 * the runner does the IO (load data, upsert findings).
 */

export type FindingSeverity = "action" | "review" | "info";

/** One step in a finding's "how we got here" breakdown — rendered as a
 *  labelled value on the detail view so the user can audit the math. */
export interface ReasoningStep {
  label: string;
  value: string;
  note?: string;
}

/** A finding a detector wants to surface, before it's persisted. */
export interface FindingDraft {
  /** Detector identifier, persisted as `agent_findings.type`. */
  type: string;
  severity: FindingSeverity;
  title: string;
  body: string;
  /** One plain-language line explaining the finding + its value, e.g.
   *  "Move it to high-yield savings to earn about $623/yr". This is what
   *  the dashboard shows, so a bare dollar figure is never ambiguous. */
  summary: string;
  /** Grounding data so the UI can show "why" without recomputing. */
  evidence: Record<string, unknown>;
  /** Annualized dollar impact of acting, when quantifiable. */
  valueAnnual?: number | null;
  suggestedAction?: { label: string } | null;
  /** The entity this is about (e.g. a recurring stream_id). */
  subjectId: string;
  /** Stable key for idempotent upserts — unique per user. */
  dedupeKey: string;
}

/** Minimal shape of a recurring stream a detector reads. Decoupled from
 *  the full DB row so detectors stay pure and testable with fixtures. */
export interface RecurringStreamInput {
  stream_id: string;
  stream_type: string;
  status: string;
  is_active: boolean;
  category_primary: string | null;
  frequency: string;
  average_amount: number;
  last_amount: number;
  merchant_name: string | null;
  description: string | null;
  last_date: string | null;
}

/** Minimal shape of a depository account a detector reads. */
export interface AccountInput {
  id: string;
  name: string;
  subtype: string | null;
  balance: number;
}

/** Minimal shape of a transaction a detector reads. Outflows are
 *  negative. Carries both the Plaid category primary and the finer
 *  `detailed` subcategory so detectors can separate, e.g., interest
 *  charges from other bank fees. */
export interface TransactionInput {
  id: string;
  date: string; // yyyy-MM-dd
  amount: number; // negative = outflow
  merchant_name: string | null;
  description: string;
  category_primary: string | null;
  category_detailed: string | null;
}

/** Everything the registered detectors are given for one user. Grows as
 *  detectors need more data (budgets, holdings…). */
export interface DetectorContext {
  streams: RecurringStreamInput[];
  accounts: AccountInput[];
  /** Outflow transactions over the trailing ~year, internal transfers
   *  included (detectors filter as needed). Used by fee/interest/spend
   *  detectors. */
  transactions: TransactionInput[];
  /** Average monthly spending (outflows, transfers excluded) over the
   *  last few complete months — used to size a realistic cash buffer. */
  monthlySpending: number;
  /** "Now" for the sweep, injected so date-relative detectors (renewals
   *  coming up, trailing-window sums) stay pure and testable. */
  now: Date;
}

export type Detector = (ctx: DetectorContext) => FindingDraft[];
