export interface InsightAction {
  /** Button label — shown to the right of the message. */
  label: string;
  /** Destination URL. Rendered as a Next.js link. */
  href: string;
}

export interface Insight {
  id: string;
  title: string;
  priority: number;
  message: string;
  tone: 'positive' | 'negative' | 'neutral';
  feature?: string;
  /**
   * Optional call-to-action shown as a pill button inside the insight
   * card. Used e.g. for the "view unmatched transfers" shortcut.
   */
  action?: InsightAction;
}

/**
 * A signal a generator surfaced from the user's data. Candidates are
 * the input to the curator: deterministic generators emit them with
 * full structured context, then a single LLM pass picks 2-3 worth
 * showing and rewrites them in plain language.
 *
 * Generators do NOT decide whether a candidate is interesting. They
 * compute facts; the curator decides what's worth a human's attention.
 * That split is the whole point of the new design — letting generators
 * gate on "is this obvious?" was producing noise like "Mortgage budget
 * 100% spent on day 21" because there's no way for `budgetAlert` to
 * know mortgage is a fixed monthly bill that's *supposed* to hit 100%
 * by day 5.
 */
export interface InsightCandidate {
  /** Stable per-instance id; doubles as the carousel id when surfaced. */
  id: string;
  /** Generator family. The curator uses this to apply kind-specific
   *  judgment ("budget_status for fixed bills is usually noise"). */
  kind: InsightCandidateKind;
  /** Default title if the curator surfaces this without rewriting. */
  defaultTitle: string;
  /** Default one-line message in the same shape the carousel renders
   *  today. The curator may rewrite, but this is the deterministic
   *  fallback if the LLM call fails. */
  defaultMessage: string;
  /** Default tone — curator may flip if the rewrite changes framing. */
  defaultTone: 'positive' | 'negative' | 'neutral';
  /** Rough priority hint (lower = higher priority); the curator
   *  ultimately decides ordering. Used as a tiebreaker in fallback. */
  priorityHint: number;
  /** Tier-gating tag (matches Insight.feature). Lets the curator skip
   *  candidates the user can't act on. */
  feature?: string;
  /** Optional CTA carried through when surfaced. */
  action?: InsightAction;
  /** Structured signal data. The curator reads this to judge
   *  interestingness. Each kind has its own context shape — see the
   *  union below. */
  context: InsightCandidateContext;
}

export type InsightCandidateKind =
  | 'budget_status'
  | 'spending_pace'
  | 'category_shift'
  | 'upcoming_bills';

export type InsightCandidateContext =
  | BudgetStatusContext
  | SpendingPaceContext
  | CategoryShiftContext
  | UpcomingBillsContext;

/**
 * Per-budget snapshot. category_type is the key signal that lets the
 * curator distinguish "mortgage at 100% on day 5" (expected) from
 * "dining at 95% on day 12" (worth flagging).
 */
export interface BudgetStatusContext {
  type: 'budget_status';
  budget_id: string;
  category_name: string;
  /** 'fixed_recurring' = mortgage, rent, insurance, loan payments, real
   *  utilities (the kind of expense that's paid in full once a month or
   *  on a known cadence). 'variable' = dining, shopping, entertainment
   *  (where pace through the month actually matters). */
  category_type: 'fixed_recurring' | 'variable' | 'unknown';
  monthly_amount: number;
  spent: number;
  percent_spent: number;
  remaining: number;
  days_into_month: number;
  days_in_month: number;
  /** % of the month elapsed. Curator compares percent_spent against
   *  this for variable budgets ("80% spent on day 10" = pacing 4x). */
  expected_pacing_percent: number;
}

export interface SpendingPaceContext {
  type: 'spending_pace';
  current_month_spending: number;
  last_month_spending: number;
  /** Positive = spending more than last month (negative = less). */
  pct_change: number;
  days_into_month: number;
}

export interface CategoryShiftContext {
  type: 'category_shift';
  category_label: string;
  current_month_spent: number;
  typical_per_category_avg: number;
  ratio: number;
  pct_above_typical: number;
}

export interface UpcomingBillsContext {
  type: 'upcoming_bills';
  count: number;
  total: number;
  /** Top items by amount (capped at 5) for the curator to namecheck. */
  top_items: Array<{ merchant_name: string; amount: number; due_date: string }>;
}

/** Format a number with commas (e.g. 18032 → "18,032") */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}
