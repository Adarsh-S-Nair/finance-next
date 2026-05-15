import { supabaseAdmin } from './supabase/admin';

export interface RuleCondition {
  field: string;
  operator:
    | 'is'
    | 'equals'
    | 'contains'
    | 'starts_with'
    | 'is_greater_than'
    | 'is_less_than'
    | string;
  value: string | number;
}

export interface CategoryRule {
  id: string;
  user_id: string;
  category_id: string;
  conditions: RuleCondition[];
  created_at: string;
  updated_at: string;
}

interface RuleableTransaction {
  category_id?: string | null;
  [key: string]: unknown;
}

/**
 * Fetches all category rules for a specific user.
 */
export async function fetchUserRules(userId: string): Promise<CategoryRule[]> {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not initialised');
    return [];
  }

  const { data, error } = await supabaseAdmin
    .from('category_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching category rules:', error);
    return [];
  }

  // conditions is stored as Json in the DB; cast to typed array.
  return (data ?? []).map((row) => ({
    ...row,
    conditions: (row.conditions as unknown as RuleCondition[]) ?? [],
  })) as CategoryRule[];
}

/**
 * Checks if a transaction matches a specific rule.
 */
export function matchesRule(
  transaction: RuleableTransaction,
  rule: CategoryRule
): boolean {
  if (!rule.conditions || !Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    return false;
  }

  // All conditions must match (AND logic)
  return rule.conditions.every((condition) => {
    const { field, operator, value } = condition;
    const transactionValue = transaction[field];

    if (transactionValue === undefined || transactionValue === null) {
      return false;
    }

    const normalizedTxValue = String(transactionValue).toLowerCase();
    const normalizedRuleValue = String(value).toLowerCase();

    // Amount comparisons match on magnitude, not sign. Expenses are
    // stored as negative numbers (-84.47) but users write rules in the
    // same way they read amounts on the screen (84.47). Direction is
    // already enforced by the category's `direction` field at apply
    // time, so we can compare magnitudes here without conflating
    // income and expense.
    const txAmount =
      field === 'amount' ? Math.abs(parseFloat(String(transactionValue))) : NaN;
    const ruleAmount =
      field === 'amount' ? Math.abs(parseFloat(String(value))) : NaN;

    switch (operator) {
      case 'is':
        if (field === 'amount') {
          return txAmount === ruleAmount;
        }
        return normalizedTxValue === normalizedRuleValue;
      case 'equals':
        if (field === 'amount') {
          return txAmount === ruleAmount;
        }
        return normalizedTxValue === normalizedRuleValue;
      case 'contains':
        return normalizedTxValue.includes(normalizedRuleValue);
      case 'starts_with':
        return normalizedTxValue.startsWith(normalizedRuleValue);
      case 'is_greater_than':
        if (field === 'amount') {
          return txAmount > ruleAmount;
        }
        return parseFloat(String(transactionValue)) > parseFloat(String(value));
      case 'is_less_than':
        if (field === 'amount') {
          return txAmount < ruleAmount;
        }
        return parseFloat(String(transactionValue)) < parseFloat(String(value));
      default:
        return false;
    }
  });
}

/**
 * Applies category rules to a list of transactions.
 * Modifies the transactions in place by setting category_id.
 * Returns the count of transactions modified.
 */
export function applyRulesToTransactions(
  transactions: RuleableTransaction[],
  rules: CategoryRule[]
): number {
  let modifiedCount = 0;

  for (const transaction of transactions) {
    for (const rule of rules) {
      if (matchesRule(transaction, rule)) {
        transaction.category_id = rule.category_id;
        modifiedCount++;
        break;
      }
    }
  }

  return modifiedCount;
}

// ──────────────────────────────────────────────────────────────────────────
// Rule comparison helpers — used by the agent's category-rules proposal
// flow to detect when a new rule overlaps with an existing one (so the
// widget can offer to replace the existing rule rather than silently
// stacking duplicates).
//
// "Overlap" here means a match-space relationship between two
// conjunctive rules: identical / one strictly narrower than the other.
// Disjoint or partially-overlapping rules return null and aren't
// flagged — they catch genuinely different patterns.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Collapse the `is` / `equals` operator pair onto the field-appropriate
 * canonical form. They're behavioural aliases (matchesRule treats them
 * identically) but the transactions-page UI uses `equals` for amount
 * fields and `is` for string fields. Without this canonicalisation, two
 * rules targeting the same set of transactions end up in the DB with
 * different operator strings and overlap detection misses the
 * duplicate.
 */
export function canonicalizeRuleOperator(field: string, operator: string): string {
  if (field === 'amount') {
    if (operator === 'is') return 'equals';
  } else {
    if (operator === 'equals') return 'is';
  }
  return operator;
}

/**
 * Operator restrictiveness rank — lower rank = narrower match space —
 * for two conditions that share the same field and the same canonical
 * value. Operators that aren't comparable (e.g. amount `equals` vs
 * `is_greater_than`: the singleton point X is NOT in the open
 * half-line `> X`) return null and are treated as "no relationship".
 *
 *  Strings (same value V):
 *    is V          → exactly V                                rank 0 (narrowest)
 *    starts_with V → strings beginning with V                 rank 1
 *    contains V    → strings containing V anywhere            rank 2 (broadest)
 *
 *  Amount: `equals` is comparable only with itself; the half-line
 *  operators don't include the boundary point so we don't try to
 *  order them against `equals`. Multi-condition rules with amount
 *  ranges fall through to "no structural relationship" — the safe
 *  default.
 */
const STRING_OPERATOR_RANK: Record<string, number> = {
  is: 0,
  starts_with: 1,
  contains: 2,
};

function operatorRank(field: string, operator: string): number | null {
  if (field === 'amount') {
    return operator === 'equals' ? 0 : null;
  }
  const r = STRING_OPERATOR_RANK[operator];
  return r ?? null;
}

/**
 * Canonical scalar value for a condition. Amount uses absolute value
 * (matchesRule compares on magnitude); strings are lowercased and
 * trimmed so case/whitespace differences don't break comparison.
 */
function canonicalConditionValue(c: RuleCondition): string {
  return c.field === 'amount'
    ? String(Math.abs(parseFloat(String(c.value))))
    : String(c.value).toLowerCase().trim();
}

/**
 * Does condition A's match space ⊆ condition B's match space? True
 * iff every transaction matching A also matches B. Conservative: only
 * proves subsumption from field + canonical value + operator rank.
 * Different values are treated as incomparable even if one is a
 * substring of the other (e.g. "Instant" ⊂ "Instant transfer" is
 * theoretically subsumable but not detected here, to keep the logic
 * predictable).
 */
export function conditionSubsumes(a: RuleCondition, b: RuleCondition): boolean {
  if (a.field !== b.field) return false;
  if (canonicalConditionValue(a) !== canonicalConditionValue(b)) return false;
  const aRank = operatorRank(
    a.field,
    canonicalizeRuleOperator(a.field, a.operator),
  );
  const bRank = operatorRank(
    b.field,
    canonicalizeRuleOperator(b.field, b.operator),
  );
  if (aRank === null || bRank === null) return false;
  return aRank <= bRank;
}

/**
 * Does the conjunction A entail the conjunction B? Rules are AND-ed
 * lists of conditions, so A entails B iff for EVERY condition in B
 * there exists a condition in A that subsumes it. When A is more
 * specific than B on every axis, A's match set ⊆ B's match set.
 */
export function rulesEntail(
  a: RuleCondition[],
  b: RuleCondition[],
): boolean {
  return b.every((bCond) => a.some((aCond) => conditionSubsumes(aCond, bCond)));
}

export type RuleRelationship = 'identical' | 'new_narrows' | 'new_broadens';

/**
 * Match-space relationship between a proposed rule's conditions and an
 * existing rule's conditions:
 *
 *  - 'identical'    → new ⊆ existing AND existing ⊆ new
 *  - 'new_narrows'  → new ⊊ existing (new is more specific)
 *  - 'new_broadens' → existing ⊊ new
 *  - null           → neither entails the other (partial overlap or
 *                      genuinely disjoint patterns; not worth flagging)
 *
 * Handles operator-subset relationships on same-field-same-value
 * conditions: a rule with `description is "X"` is correctly identified
 * as narrower than a rule with `description contains "X"`, because
 * `is V` ⊊ `contains V` for any value V. The earlier opaque-key
 * implementation missed these cases and let structurally-redundant
 * rules sit alongside each other in the DB.
 */
export function ruleRelationship(
  newConds: RuleCondition[],
  existingConds: RuleCondition[],
): RuleRelationship | null {
  const newEntailsExisting = rulesEntail(newConds, existingConds);
  const existingEntailsNew = rulesEntail(existingConds, newConds);
  if (newEntailsExisting && existingEntailsNew) return 'identical';
  if (newEntailsExisting) return 'new_narrows';
  if (existingEntailsNew) return 'new_broadens';
  return null;
}
