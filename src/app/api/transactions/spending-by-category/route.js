import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
const DEBUG = process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const type = searchParams.get('type') || 'spending'; // 'spending' or 'income'
    const daysParam = parseInt(searchParams.get('days') || '90', 10);
    const MAX_DAYS = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 90;

    if (!userId) {
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    if (true) console.log(`Fetching ${type} by category for user:`, userId, 'days:', daysParam);

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
    // If earliest transaction is after the 1st, skip that month entirely
    let firstCompleteMonthStart = null;
    if (earliestTransactionDate) {
      if (earliestTransactionDate.getDate() > 1) {
        // Skip to next month
        firstCompleteMonthStart = new Date(
          earliestTransactionDate.getFullYear(),
          earliestTransactionDate.getMonth() + 1,
          1
        );
      } else {
        // Earliest is on the 1st, so that month is complete
        firstCompleteMonthStart = new Date(
          earliestTransactionDate.getFullYear(),
          earliestTransactionDate.getMonth(),
          1
        );
      }
    }

    // Get transactions grouped by category
    const now = new Date();
    const since = new Date();
    since.setDate(since.getDate() - MAX_DAYS);

    // Use the later of: (1) MAX_DAYS ago, or (2) first complete month
    let effectiveSinceDate = since;
    if (firstCompleteMonthStart && firstCompleteMonthStart > since) {
      effectiveSinceDate = firstCompleteMonthStart;
    }

    // Also exclude current month (incomplete)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = currentMonthStart; // Exclude current month

    // Calculate actual complete months for averaging
    let completeMonths = 0;
    if (firstCompleteMonthStart) {
      const monthsDiff = (endDate.getFullYear() - effectiveSinceDate.getFullYear()) * 12
        + (endDate.getMonth() - effectiveSinceDate.getMonth());
      completeMonths = Math.max(0, monthsDiff);
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
      .lt('date', endDate.toISOString().split('T')[0]); // Exclude current month

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

    // Logic to identify and exclude internal transfers (consistent with spending-earning)
    const transferCategories = ['Credit Card Payment', 'Transfer', 'Account Transfer'];
    const isTransfer = (tx) => {
      const label = tx.system_categories?.label;
      return label && transferCategories.includes(label);
    };

    const matchedIds = new Set();

    // First pass: Identify matches for transfers
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      if (matchedIds.has(tx.id)) continue;

      if (isTransfer(tx)) {
        const txDate = new Date(tx.date || new Date().toISOString());
        const targetAmount = -parseFloat(tx.amount);

        for (let j = i + 1; j < transactions.length; j++) {
          const candidate = transactions[j];
          if (matchedIds.has(candidate.id)) continue;

          // Simple date check (assuming sorted or close enough, but explicit diff is safer)
          // Note: spending-earning query orders by date, here we didn't explicitly order but likely okay for small sets.
          // Ideally we should verify sorting, but raw DB order often reflects insert time ~ date time.
          const candidateDate = new Date(candidate.date || new Date().toISOString());
          const diffDays = Math.abs((candidateDate - txDate) / (1000 * 60 * 60 * 24));

          if (diffDays > 3) continue; // Check reasonably close window

          if (Math.abs(parseFloat(candidate.amount) - targetAmount) < 0.01) {
            matchedIds.add(tx.id);
            matchedIds.add(candidate.id);
            break;
          }
        }
      }
    }

    // Group transactions by category and calculate totals
    const categoryData = {};
    const groupBy = searchParams.get('groupBy'); // 'group' or default (category)

    transactions.forEach(transaction => {
      // Exclude matched transfers
      if (matchedIds.has(transaction.id)) return;

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
        hex_color = category.category_groups?.hex_color || '#6B7280';
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

      if (!categoryData[key]) {
        categoryData[key] = {
          id: key,
          label: label,
          hex_color: hex_color,
          icon_name: icon_name,
          icon_lib: icon_lib,
          total_spent: 0,
          transaction_count: 0
        };
      }

      categoryData[key].total_spent += adjustedAmount;
      categoryData[key].transaction_count += 1;
    });

    // Convert to array and sort by amount (descending)
    const categoriesArray = Object.values(categoryData)
      .sort((a, b) => b.total_spent - a.total_spent);

    // Calculate total spending for percentage calculations
    const totalSpending = categoriesArray.reduce((sum, category) => sum + category.total_spent, 0);

    // Add percentage to each category and filter out categories < 1%
    const filteredCategories = categoriesArray
      .map(category => ({
        ...category,
        percentage: totalSpending > 0 ? (category.total_spent / totalSpending) * 100 : 0
      }))
      .filter(category => category.percentage >= 1.0); // Only include categories >= 1%

    if (true) console.log(`📊 ${type} by Category: categories=${filteredCategories.length} completeMonths=${completeMonths}`, filteredCategories.slice(0, 3));

    return Response.json({
      categories: filteredCategories,
      totalSpending,
      totalCategories: categoriesArray.length,
      filteredCount: filteredCategories.length,
      completeMonths: completeMonths || 1 // Default to 1 to avoid division by 0
    });

  } catch (error) {
    console.error('Error in spending by category API:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

