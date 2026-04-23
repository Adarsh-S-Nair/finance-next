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

    switch (operator) {
      case 'is':
        if (field === 'amount') {
          return parseFloat(String(transactionValue)) === parseFloat(String(value));
        }
        return normalizedTxValue === normalizedRuleValue;
      case 'equals':
        if (field === 'amount') {
          return parseFloat(String(transactionValue)) === parseFloat(String(value));
        }
        return normalizedTxValue === normalizedRuleValue;
      case 'contains':
        return normalizedTxValue.includes(normalizedRuleValue);
      case 'starts_with':
        return normalizedTxValue.startsWith(normalizedRuleValue);
      case 'is_greater_than':
        return parseFloat(String(transactionValue)) > parseFloat(String(value));
      case 'is_less_than':
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
