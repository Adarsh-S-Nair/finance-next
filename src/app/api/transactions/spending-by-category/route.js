import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';
import { identifyTransfers, isTransfer } from '../../../../lib/transfer-matching';
const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

export async function GET(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'spending'; // 'spending' or 'income'
    const daysParam = parseInt(searchParams.get('days') || '90', 10);
    const MAX_DAYS = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 90;
    // When forBudget=true, only include complete months for accurate averaging
    const forBudget = searchParams.get('forBudget') === 'true';
    // Optional explicit date range (overrides days parameter)
    const startDateParam = searchParams.get('startDate'); // YYYY-MM-DD format
    const endDateParam = searchParams.get('endDate'); // YYYY-MM-DD format

    if (DEBUG) console.log(`Fetching ${type} by category for user:`, userId, 'days:', daysParam, 'forBudget:', forBudget, 'startDate:', startDateParam, 'endDate:', endDateParam);

    // Get transactions grouped by category
    const now = new Date();
    let effectiveSinceDate;
    let endDate = null; // null means include up to now
    let completeMonths = 0;

    // Default since date (used as fallback or base)
    const since = new Date();
    since.setDate(since.getDate() - MAX_DAYS);

    // Use explicit date range if provided, otherwise fall back to days-based calculation
    if (startDateParam) {
      effectiveSinceDate = new Date(startDateParam);
      if (endDateParam) {
        endDate = new Date(endDateParam);
        // Add one day to include the end date
        endDate.setDate(endDate.getDate() + 1);
      }
    } else {
      effectiveSinceDate = since;
    }

    // Only apply complete-month filtering for budget calculations
    if (forBudget) {
      // Determine the user's earliest transaction date to exclude incomplete months
      const { data: earliestTxResult } = await supabaseAdmin
        .from('transactions')
        .select('date, accounts!inner(user_id)')
        .eq('accounts.user_id', userId)
        .order('date', { ascending: true })
        .limit(1);

      const earliestTransactionDate = earliestTxResult?.[0]?.date
        ? new Date(earliestTxResult[0].date)
        : null;

      // Calculate the start of the first complete month
      let firstCompleteMonthStart = null;
      if (earliestTransactionDate) {
        if (earliestTransactionDate.getDate() > 1) {
          firstCompleteMonthStart = new Date(
            earliestTransactionDate.getFullYear(),
            earliestTransactionDate.getMonth() + 1,
            1
          );
        } else {
          firstCompleteMonthStart = new Date(
            earliestTransactionDate.getFullYear(),
            earliestTransactionDate.getMonth(),
            1
          );
        }
      }

      // Use the later of: (1) MAX_DAYS ago, or (2) first complete month
      if (firstCompleteMonthStart && firstCompleteMonthStart > since) {
        effectiveSinceDate = firstCompleteMonthStart;
      }

      // Exclude current month (incomplete) for budget calculations
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = currentMonthStart;

      // Calculate actual complete months for averaging
      if (firstCompleteMonthStart) {
        const monthsDiff = (endDate.getFullYear() - effectiveSinceDate.getFullYear()) * 12
          + (endDate.getMonth() - effectiveSinceDate.getMonth());
        completeMonths = Math.max(0, monthsDiff);
      }
    }

    // Fetch IDs of categories to ALWAYS exclude (consistent with cashflow)
    const alwaysExcludedCategories = [
      'Investment and Retirement Funds'
    ];

    const { data: excludedCategoryRows } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .in('label', alwaysExcludedCategories);

    const excludedCategoryIds = excludedCategoryRows?.map(c => c.id) || [];

    let query = supabaseAdmin
      .from('transactions')
      .select(`
        id,
        amount,
        date,
        system_categories (
          id,
          label,
          hex_color,
          category_groups (
            id,
            name,
            hex_color,
            icon_lib,
            icon_name
          )
        ),
        transaction_splits (
          amount,
          is_settled
        ),
        transaction_repayments (
          id
        ),
        accounts!inner (
          user_id
        )
      `)
      .eq('accounts.user_id', userId)
      .not('system_categories', 'is', null)
      .gte('date', effectiveSinceDate.toISOString().split('T')[0])
      .order('date', { ascending: true });

    // Only apply end date filter for budget calculations (exclude current month)
    if (endDate) {
      query = query.lt('date', endDate.toISOString().split('T')[0]);
    }

    // Apply exclusion filter for "Investment and Retirement Funds"
    if (excludedCategoryIds.length > 0) {
      query = query.not('category_id', 'in', `(${excludedCategoryIds.join(',')})`);
    }

    // Filter by type (basic filter,    // Filter by type (basic filter, refined below)
    // NOTE: We fetch ALL transactions (both income and expense) to ensure we can correctly identify and match
    // transfers (e.g. a negative Credit Card Payment needs its positive counterpart to be identified as a transfer).
    // We will filter by type IN MEMORY after the matching logic.
    /* 
    if (type === 'income') {
      query = query.gt('amount', 0);
    } else {
      query = query.lt('amount', 0);
    }
    */

    const { data: transactions, error } = await query;

    if (error) {
      console.error('Error fetching spending by category:', error);
      return Response.json(
        { error: 'Failed to fetch spending data' },
        { status: 500 }
      );
    }

    // Identify and exclude internal transfers using shared utility
    const { matchedIds } = identifyTransfers(transactions);

    // Group transactions by category and calculate totals
    const categoryData = {};
    const groupBy = searchParams.get('groupBy'); // 'group' or default (category)

    // When forBudget=true, filter out buckets that don't appear consistently
    // across months. Budgets are about recurring spend, not one-time purchases.
    // Can be disabled with ?consistent=false for an "all categories" view.
    const consistentFilter =
      forBudget && searchParams.get('consistent') !== 'false';

    transactions.forEach(transaction => {
      // Exclude matched transfers (pairs like credit card payment out + payment in)
      if (matchedIds.has(transaction.id)) return;

      // Exclude ALL transfer-type transactions (matched or unmatched)
      if (isTransfer(transaction)) return;

      // Exclude repayments
      if (transaction.transaction_repayments && transaction.transaction_repayments.length > 0) return;

      const category = transaction.system_categories;
      if (!category) return;

      let key, label, hex_color, icon_name, icon_lib;

      if (groupBy === 'group') {
        key = category.category_groups?.id || 'other';
        label = category.category_groups?.name || 'Other';
        hex_color = category.category_groups?.hex_color || '#6B7280';
        icon_name = category.category_groups?.icon_name;
        icon_lib = category.category_groups?.icon_lib;
      } else {
        key = category.id;
        label = category.label;
        hex_color = category.hex_color || category.category_groups?.hex_color || '#6B7280';
        icon_name = category.category_groups?.icon_name;
        icon_lib = category.category_groups?.icon_lib;
      }

      const rawAmount = parseFloat(transaction.amount);

      // Filter by type (now done in memory)
      if (type === 'spending' && rawAmount > 0) return;
      if (type === 'income' && rawAmount < 0) return;

      // Calculate settled reimbursement amount
      const settledReimbursement = transaction.transaction_splits?.reduce((sum, split) => {
        return split.is_settled ? sum + (parseFloat(split.amount) || 0) : sum;
      }, 0) || 0;

      let adjustedAmount = 0;
      if (rawAmount < 0) { // Spending
        adjustedAmount = Math.max(0, Math.abs(rawAmount) - settledReimbursement);
      } else { // Income (if type allows)
        adjustedAmount = rawAmount;
      }

      if (adjustedAmount === 0) return; // Skip if fully reimbursed or zero

      // Track which month this transaction belongs to so we can compute
      // "months-with-spending" per bucket. Parse YYYY-MM directly from the
      // date string to avoid timezone drift.
      const monthKey = (transaction.date || '').slice(0, 7);

      if (!categoryData[key]) {
        categoryData[key] = {
          id: key,
          label: label,
          hex_color: hex_color,
          icon_name: icon_name,
          icon_lib: icon_lib,
          total_spent: 0,
          transaction_count: 0,
          months_seen: new Set()
        };
      }

      categoryData[key].total_spent += adjustedAmount;
      categoryData[key].transaction_count += 1;
      if (monthKey) categoryData[key].months_seen.add(monthKey);
    });

    // Convert to array. Compute "typical monthly" based on months the bucket
    // actually had spending, not total months — otherwise recurring categories
    // look artificially low because one month was missed.
    const effectiveMonths = completeMonths > 0 ? completeMonths : 1;
    const consistencyThreshold = Math.max(1, Math.ceil(effectiveMonths * (2 / 3)));

    const categoriesArray = Object.values(categoryData)
      .map(c => {
        const monthsWith = c.months_seen.size;
        const monthlyAvg = monthsWith > 0
          ? Math.round(c.total_spent / monthsWith)
          : 0;
        return {
          id: c.id,
          label: c.label,
          hex_color: c.hex_color,
          icon_name: c.icon_name,
          icon_lib: c.icon_lib,
          total_spent: c.total_spent,
          transaction_count: c.transaction_count,
          months_with_spending: monthsWith,
          monthly_avg: monthlyAvg,
        };
      })
      .sort((a, b) => b.total_spent - a.total_spent);

    // Calculate total spending for percentage calculations
    const totalSpending = categoriesArray.reduce((sum, category) => sum + category.total_spent, 0);

    // Add percentage. Apply >=1% floor always; apply consistency filter when
    // forBudget=true and not explicitly disabled.
    const filteredCategories = categoriesArray
      .map(category => ({
        ...category,
        percentage: totalSpending > 0 ? (category.total_spent / totalSpending) * 100 : 0,
        is_consistent: category.months_with_spending >= consistencyThreshold,
      }))
      .filter(category => {
        if (category.percentage < 1.0) return false;
        if (consistentFilter && !category.is_consistent) return false;
        return true;
      });

    if (DEBUG) console.log(`📊 ${type} by Category: categories=${filteredCategories.length} completeMonths=${completeMonths} threshold=${consistencyThreshold}`, filteredCategories.slice(0, 3));

    return Response.json({
      categories: filteredCategories,
      totalSpending,
      totalCategories: categoriesArray.length,
      filteredCount: filteredCategories.length,
      completeMonths: completeMonths || 1, // Default to 1 to avoid division by 0
      consistencyThreshold,
    });

  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error in spending by category API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

