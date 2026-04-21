import { startOfMonth, endOfMonth, subMonths, isValid } from 'date-fns';

/**
 * Calculates budget progress for the specified user and month.
 * 
 * @param {Object} supabase - Supabase client (Client or Admin)
 * @param {string} userId - The User ID to fetch data for
 * @param {string|Date} monthDate - Date object or string for the month to calculate (default: now)
 * @returns {Promise<Array>} Array of budget objects with calculated stats { spent, remaining, percentage }
 */
export async function getBudgetProgress(supabase, userId, monthDate = null) {
  if (!userId) throw new Error('UserId is required');
  // Callers may pass null (API passes searchParams.get() which returns
  // null when the param is missing) or omit the arg entirely. JS default
  // params only kick in for `undefined`, so a raw null would coerce to
  // new Date(0) = 1970 and the function would silently filter for
  // transactions in January 1970. Normalize both cases here.
  const date = monthDate ? new Date(monthDate) : new Date();
  if (!isValid(date)) throw new Error('Invalid date provided');

  const start = startOfMonth(date).toISOString();
  const end = endOfMonth(date).toISOString();

  // 1. Fetch Budgets with expanded details, filtered by user
  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select(`
      *,
      category_groups (id, name, icon_name, icon_lib, hex_color),
      system_categories (id, label, group_id, hex_color)
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

    // Transactions are stored with the convention: negative = spending,
    // positive = income/refunds. Only count spending against the budget,
    // and flip the sign so `spent` is a positive dollar amount. This
    // matches how /api/transactions/spending-by-category sums things.
    spent = relevantTransactions.reduce((sum, tx) => {
      const amt = Number(tx.amount) || 0;
      if (amt >= 0) return sum; // skip income/refunds/transfers
      return sum + Math.abs(amt);
    }, 0);

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
 * Aggregates spending in budgeted categories by day for the current (or
 * specified) month. Returns a daily cumulative series the UI can plot as
 * a burn-down chart.
 *
 * Returned shape:
 *   [{ day: 1, spent: 8.95,  cumulative: 8.95 },
 *    { day: 2, spent: 13.02, cumulative: 21.97 }, ...]
 *
 * Only days with spending are included — the client can fill gaps or
 * step-interpolate. The function does its own queries rather than reusing
 * getBudgetProgress so callers can invoke it independently.
 */
export async function getMonthlyBurn(supabase, userId, monthDate = null) {
  if (!userId) throw new Error('UserId is required');
  const date = monthDate ? new Date(monthDate) : new Date();
  if (!isValid(date)) throw new Error('Invalid date provided');

  const start = startOfMonth(date).toISOString();
  const end = endOfMonth(date).toISOString();

  // Budgets with their direct category / group membership.
  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select('category_id, category_group_id')
    .eq('user_id', userId);
  if (budgetError) throw budgetError;
  if (!budgets || budgets.length === 0) return [];

  const budgetedCategoryIds = new Set(
    budgets.map((b) => b.category_id).filter(Boolean)
  );
  const budgetedGroupIds = new Set(
    budgets.map((b) => b.category_group_id).filter(Boolean)
  );

  // If the user only budgets at the group level, we need a category→group
  // map to decide which transactions count.
  let categoryGroupMap = new Map();
  if (budgetedGroupIds.size > 0) {
    const { data: allCategories, error: catError } = await supabase
      .from('system_categories')
      .select('id, group_id');
    if (catError) throw catError;
    allCategories?.forEach((c) => categoryGroupMap.set(c.id, c.group_id));
  }

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, category_id, date, accounts!inner(user_id)')
    .eq('accounts.user_id', userId)
    .gte('datetime', start)
    .lte('datetime', end);
  if (txError) throw txError;

  // Aggregate negative-amount transactions by day-of-month, but only when
  // they hit a budgeted category (directly or via its group).
  const perDay = new Map();
  transactions?.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (amt >= 0) return;

    const matchesBudget =
      budgetedCategoryIds.has(tx.category_id) ||
      budgetedGroupIds.has(categoryGroupMap.get(tx.category_id));
    if (!matchesBudget) return;

    // Use the date column (YYYY-MM-DD) directly so we don't drift across
    // time zones.
    const day = Number((tx.date || '').slice(8, 10));
    if (!day) return;
    perDay.set(day, (perDay.get(day) || 0) + Math.abs(amt));
  });

  // Build a cumulative series sorted by day.
  const sortedDays = Array.from(perDay.keys()).sort((a, b) => a - b);
  let running = 0;
  return sortedDays.map((day) => {
    const spent = perDay.get(day);
    running += spent;
    return { day, spent, cumulative: Number(running.toFixed(2)) };
  });
}

/**
 * Returns per-budget spending for each of the last N months (including the
 * current, incomplete month). Used by the Budget Performance chart.
 *
 * Returned shape:
 *   [{ month: 'Jan', year: 2026, monthNumber: 1, isCurrent: false,
 *      budgets: [{ id, label, color, amount, spent }] }]
 *
 * Fetches budgets once and all relevant transactions in a single query,
 * then groups in JS to avoid N+1 round trips.
 */
export async function getBudgetHistory(supabase, userId, months = 6) {
  if (!userId) throw new Error('UserId is required');

  // 1. Fetch budgets with expanded details
  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select(`
      *,
      category_groups (id, name, icon_name, icon_lib, hex_color),
      system_categories (id, label, group_id, hex_color)
    `)
    .eq('user_id', userId);
  if (budgetError) throw budgetError;
  if (!budgets || budgets.length === 0) return [];

  // 2. Build category -> group map
  const budgetedGroupIds = new Set(
    budgets.map((b) => b.category_group_id).filter(Boolean)
  );
  let categoryGroupMap = new Map();
  if (budgetedGroupIds.size > 0) {
    const { data: allCategories, error: catError } = await supabase
      .from('system_categories')
      .select('id, group_id');
    if (catError) throw catError;
    allCategories?.forEach((c) => categoryGroupMap.set(c.id, c.group_id));
  }

  // 3. Determine date range: start of (months-1) months ago through end of
  //    current month. e.g. months=6 gives 5 complete past months + current.
  const now = new Date();
  const rangeStart = startOfMonth(subMonths(now, months - 1)).toISOString();
  const rangeEnd = endOfMonth(now).toISOString();

  // 4. Fetch all transactions in range
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, category_id, date, accounts!inner(user_id)')
    .eq('accounts.user_id', userId)
    .gte('datetime', rangeStart)
    .lte('datetime', rangeEnd);
  if (txError) throw txError;

  // 5. Build month buckets
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthNames = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const monthBuckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    monthBuckets.push({
      month: monthNames[m],
      year: y,
      monthNumber: m,
      isCurrent: m === currentMonth && y === currentYear,
      budgets: budgets.map((b) => {
        const isGroup = !!b.category_groups;
        return {
          id: b.id,
          label: isGroup ? b.category_groups.name : (b.system_categories?.label || 'Unknown'),
          color: isGroup ? (b.category_groups?.hex_color || '#71717a') : (b.system_categories?.hex_color || '#71717a'),
          amount: Number(b.amount || 0),
          spent: 0,
          category_id: b.category_id,
          category_group_id: b.category_group_id,
        };
      }),
    });
  }

  // 6. Distribute transactions into month buckets
  transactions?.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (amt >= 0) return; // skip income/refunds

    // Parse month/year from date column (YYYY-MM-DD)
    const txDate = tx.date || '';
    const txYear = Number(txDate.slice(0, 4));
    const txMonth = Number(txDate.slice(5, 7));

    const bucket = monthBuckets.find(
      (b) => b.monthNumber === txMonth && b.year === txYear
    );
    if (!bucket) return;

    // Find matching budget(s) in this bucket
    bucket.budgets.forEach((bb) => {
      if (bb.category_id) {
        if (tx.category_id === bb.category_id) {
          bb.spent += Math.abs(amt);
        }
      } else if (bb.category_group_id) {
        const txGroupId = categoryGroupMap.get(tx.category_id);
        if (txGroupId === bb.category_group_id) {
          bb.spent += Math.abs(amt);
        }
      }
    });
  });

  // 7. Round spent values
  monthBuckets.forEach((bucket) => {
    bucket.budgets.forEach((bb) => {
      bb.spent = Number(bb.spent.toFixed(2));
      // Clean up internal fields
      delete bb.category_id;
      delete bb.category_group_id;
    });
  });

  return monthBuckets;
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
