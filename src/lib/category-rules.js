import { supabaseAdmin } from './supabaseAdmin';

/**
 * Fetches all category rules for a specific user.
 * @param {string} userId - The UUID of the user.
 * @returns {Promise<Array>} - Array of rule objects.
 */
export async function fetchUserRules(userId) {
  const { data, error } = await supabaseAdmin
    .from('category_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false }); // Newest rules first

  if (error) {
    console.error('Error fetching category rules:', error);
    return [];
  }

  return data || [];
}

/**
 * Checks if a transaction matches a specific rule.
 * @param {Object} transaction - The transaction object.
 * @param {Object} rule - The rule object containing conditions.
 * @returns {boolean} - True if the transaction matches the rule.
 */
export function matchesRule(transaction, rule) {
  if (!rule.conditions || !Array.isArray(rule.conditions) || rule.conditions.length === 0) {
    return false;
  }

  // All conditions must match (AND logic)
  return rule.conditions.every(condition => {
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
          return parseFloat(transactionValue) === parseFloat(value);
        }
        return normalizedTxValue === normalizedRuleValue;
      case 'contains':
        return normalizedTxValue.includes(normalizedRuleValue);
      case 'starts_with':
        return normalizedTxValue.startsWith(normalizedRuleValue);
      case 'is_greater_than':
        return parseFloat(transactionValue) > parseFloat(value);
      case 'is_less_than':
        return parseFloat(transactionValue) < parseFloat(value);
      default:
        return false;
    }
  });
}

/**
 * Applies category rules to a list of transactions.
 * Modifies the transactions in place by setting category_id.
 * @param {Array} transactions - List of transaction objects to process.
 * @param {Array} rules - List of rules to apply.
 * @returns {number} - Count of transactions modified.
 */
export function applyRulesToTransactions(transactions, rules) {
  let modifiedCount = 0;

  for (const transaction of transactions) {
    // Skip if category is already set (optional, but maybe we want rules to override?)
    // For now, let's assume rules override system categorization but maybe not manual?
    // In sync context, category_id is usually null or system-assigned.
    // Let's allow rules to override whatever is there currently.

    for (const rule of rules) {
      if (matchesRule(transaction, rule)) {
        transaction.category_id = rule.category_id;
        modifiedCount++;
        break; // Stop after first match (since rules are ordered by priority/recency)
      }
    }
  }

  return modifiedCount;
}
