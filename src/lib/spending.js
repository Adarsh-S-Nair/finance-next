import { startOfMonth, endOfMonth, isValid } from 'date-fns';

/**
 * Calculates budget progress for the specified user and month.
 * 
 * @param {Object} supabase - Supabase client (Client or Admin)
 * @param {string} userId - The User ID to fetch data for
 * @param {string|Date} monthDate - Date object or string for the month to calculate (default: now)
 * @returns {Promise<Array>} Array of budget objects with calculated stats { spent, remaining, percentage }
 */
export async function getBudgetProgress(supabase, userId, monthDate = new Date()) {
  if (!userId) throw new Error('UserId is required');
  const date = new Date(monthDate);
  if (!isValid(date)) throw new Error('Invalid date provided');

  const start = startOfMonth(date).toISOString();
  const end = endOfMonth(date).toISOString();

  // 1. Fetch Budgets with expanded details, filtered by user
  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select(`
      *,
      category_groups (id, name, icon_name, icon_lib),
      system_categories (id, label, group_id)
    `)
    .eq('user_id', userId);

  if (budgetError) {
    console.error('Error fetching budgets:', budgetError);
    throw budgetError;
  }

  if (!budgets || budgets.length === 0) return [];

  // 2. Fetch Transactions for the month, filtered by user via accounts
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, category_id, datetime, accounts!inner(user_id)')
    .eq('accounts.user_id', userId)
    .gte('datetime', start)
    .lte('datetime', end);

  if (txError) {
    console.error('Error fetching transactions:', txError);
    throw txError;
  }

  // 3. Map transactions to budgets
  // Fetch all system categories to build a complete map of category_id -> group_id
  // This is needed because transactions only store category_id, but a budget might be for a group
  const { data: allCategories, error: catError } = await supabase
    .from('system_categories')
    .select('id, group_id');

  if (catError) {
    console.error('Error fetching categories for mapping:', catError);
    throw catError;
  }

  const categoryGroupMap = new Map();
  allCategories?.forEach(cat => {
    categoryGroupMap.set(cat.id, cat.group_id);
  });

  const budgetProgress = budgets.map(budget => {
    let spent = 0;

    // Filter transactions matching this budget
    const relevantTransactions = transactions.filter(tx => {
      // Direct Category Match
      if (budget.category_id) {
        return tx.category_id === budget.category_id;
      }

      // Group Match
      if (budget.category_group_id) {
        const txGroupId = categoryGroupMap.get(tx.category_id);
        return txGroupId === budget.category_group_id;
      }

      return false;
    });

    // Sum positive amounts (assuming positive = spending)
    spent = relevantTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const total = Number(budget.amount);
    const remaining = total - spent;
    // Cap percentage at 100 for visual bars? Or allow >100? Logic usually allows >100 to show overspending.
    const percentage = total > 0 ? (spent / total) * 100 : (spent > 0 ? 100 : 0);

    return {
      ...budget,
      spent,
      remaining,
      percentage
    };
  });

  return budgetProgress;
}

/**
 * Creates or updates a budget.
 * @param {Object} supabase - Supabase client
 * @param {Object} budgetData - Budget object including user_id
 */
export async function upsertBudget(supabase, budgetData) {
  // Ensure we are not setting both category_id and category_group_id unless one is null
  // The DB constraint handles this, but good to clean up payload
  if (!budgetData.user_id) throw new Error('user_id is required in budgetData');

  const { data, error } = await supabase
    .from('budgets')
    .upsert(budgetData)
    .select()
    .single();

  if (error) console.error('Error upserting budget:', error);
  if (error) throw error;

  return data;
}

/**
 * Deletes a budget.
 * @param {Object} supabase - Supabase client
 * @param {string} budgetId - ID of the budget to delete
 * @param {string} userId - Owner ID for safety
 */
export async function deleteBudget(supabase, budgetId, userId) {
  if (!userId) throw new Error('userId is required for deletion safety');

  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('user_id', userId);

  if (error) console.error('Error deleting budget:', error);
  if (error) throw error;

  return true;
}
