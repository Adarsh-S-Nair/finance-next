import type { InsightCandidate } from '../types';
import { formatNumber } from '../types';

interface BudgetProgress {
  id: string;
  amount: number;
  spent: number;
  remaining: number;
  percentage: number;
  category_groups?: { name: string } | null;
  system_categories?: { label: string } | null;
}

/**
 * Category group / category names that almost always represent a fixed
 * recurring bill paid in full once a month. The curator uses this to
 * suppress "100% spent" alerts for these categories on day 5 — that's
 * expected behavior, not a warning.
 *
 * The list is intentionally narrow. When in doubt, mark 'unknown' and
 * let the curator look at percent_spent vs expected_pacing_percent to
 * decide. Better to occasionally surface a fixed bill the curator
 * downgrades than to silently swallow a real budget overrun on a
 * miscategorized transaction.
 */
const FIXED_RECURRING_KEYWORDS = [
  'mortgage',
  'rent',
  'rent and utilities',
  'loan payment',
  'loan payments',
  'auto loan',
  'student loan',
  'personal loan',
  'insurance',
  'utilities',
  'housing',
];

function classifyCategory(name: string): 'fixed_recurring' | 'variable' | 'unknown' {
  const lower = name.toLowerCase();
  if (FIXED_RECURRING_KEYWORDS.some((kw) => lower.includes(kw))) {
    return 'fixed_recurring';
  }
  // Common variable buckets — naming them explicitly so the curator
  // can lean into pacing math for these without second-guessing.
  if (
    lower.includes('food') ||
    lower.includes('dining') ||
    lower.includes('restaurant') ||
    lower.includes('coffee') ||
    lower.includes('shopping') ||
    lower.includes('entertainment') ||
    lower.includes('travel') ||
    lower.includes('personal')
  ) {
    return 'variable';
  }
  return 'unknown';
}

/**
 * Emits one candidate per budget that's at >= 50% spent. The curator
 * decides which (if any) are worth surfacing based on category_type
 * and pacing — generators don't pre-filter on "is this obvious?".
 *
 * The 50% floor is just a noise cut: budgets at <50% rarely have
 * anything for the curator to say. The curator typically picks one,
 * not all.
 */
export function budgetAlertCandidates(budgets: BudgetProgress[]): InsightCandidate[] {
  if (!budgets || budgets.length === 0) return [];

  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysIntoMonth = now.getDate();
  const daysLeft = daysInMonth - daysIntoMonth;
  const expectedPacing = (daysIntoMonth / daysInMonth) * 100;

  const candidates: InsightCandidate[] = [];

  for (const b of budgets) {
    if (!b.percentage || b.percentage < 50) continue;

    const name = b.category_groups?.name || b.system_categories?.label || 'A budget';
    const categoryType = classifyCategory(name);
    const pct = Math.round(b.percentage);
    const daysLabel = daysLeft === 1 ? '1 day' : `${daysLeft} days`;

    candidates.push({
      id: `budget-status:${b.id}`,
      kind: 'budget_status',
      defaultTitle: `${name} Budget`,
      defaultMessage: `Your ${name} budget is ${formatNumber(pct)}% spent with ${daysLabel} left this month.`,
      defaultTone: pct >= 100 ? 'negative' : pct >= 90 ? 'negative' : 'neutral',
      priorityHint: 1,
      feature: 'budgets',
      context: {
        type: 'budget_status',
        budget_id: b.id,
        category_name: name,
        category_type: categoryType,
        monthly_amount: b.amount,
        spent: b.spent,
        percent_spent: pct,
        remaining: b.remaining,
        days_into_month: daysIntoMonth,
        days_in_month: daysInMonth,
        expected_pacing_percent: Math.round(expectedPacing),
      },
    });
  }

  return candidates;
}
