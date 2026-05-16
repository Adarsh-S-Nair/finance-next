import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';
import { identifyTransfers, isTransfer, type TransferShape } from '../../../../lib/transfer-matching';
const DEBUG =
  process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

interface SpendingTx {
  id: string;
  amount: number;
  date: string | null;
  system_categories: {
    id: string;
    label: string;
    hex_color: string;
    category_groups: {
      id: string;
      name: string;
      hex_color: string;
      icon_lib: string | null;
      icon_name: string | null;
    } | null;
  } | null;
  transaction_splits: { amount: number; is_settled: boolean | null }[];
  transaction_repayments: { id: string }[];
  accounts: { user_id: string };
}

interface CategoryDatum {
  id: string;
  label: string;
  hex_color: string;
  icon_name: string | null;
  icon_lib: string | null;
  // Parent group is captured when grouping by category so callers can
  // re-group on the client (e.g. the goals page renders categories
  // nested under their parent group with a per-category toggle).
  // Null when groupBy=group, since each row IS the group.
  group_id: string | null;
  group_name: string | null;
  total_spent: number;
  transaction_count: number;
  months_seen: Set<string>;
}

export const GET = withAuth('spending-by-category', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'spending';
  const daysParam = parseInt(searchParams.get('days') || '90', 10);
  const MAX_DAYS = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 365) : 90;
  const forBudget = searchParams.get('forBudget') === 'true';
  // Minimum % of total spending a category must represent to be returned.
  // Defaults to 1.0% when forBudget=true (filters noise from budget
  // suggestions) and 0% otherwise. Callers like the goals/emergency-fund
  // flow can pass `minPercent=0` to opt out — every essential category
  // matters there, even small ones like a transit commute.
  const minPercentParam = searchParams.get('minPercent');
  const minPercent =
    minPercentParam !== null
      ? Math.max(0, Number(minPercentParam))
      : forBudget
        ? 1.0
        : 0;
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');

  if (DEBUG)
    console.log(
      `Fetching ${type} by category for user:`,
      userId,
      'days:',
      daysParam,
      'forBudget:',
      forBudget,
      'startDate:',
      startDateParam,
      'endDate:',
      endDateParam
    );

  const now = new Date();
  let effectiveSinceDate: Date;
  let endDate: Date | null = null;
  let completeMonths = 0;

  const since = new Date();
  since.setDate(since.getDate() - MAX_DAYS);

  if (startDateParam) {
    effectiveSinceDate = new Date(startDateParam);
    if (endDateParam) {
      endDate = new Date(endDateParam);
      endDate.setDate(endDate.getDate() + 1);
    }
  } else {
    effectiveSinceDate = since;
  }

  if (forBudget) {
    const { data: earliestTxResult } = await supabaseAdmin
      .from('transactions')
      .select('date, accounts!inner(user_id)')
      .eq('accounts.user_id', userId)
      .order('date', { ascending: true })
      .limit(1);

    const earliestTransactionDate = earliestTxResult?.[0]?.date
      ? new Date(earliestTxResult[0].date)
      : null;

    let firstCompleteMonthStart: Date | null = null;
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

    if (firstCompleteMonthStart && firstCompleteMonthStart > since) {
      effectiveSinceDate = firstCompleteMonthStart;
    }

    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = currentMonthStart;

    if (firstCompleteMonthStart) {
      const monthsDiff =
        (endDate.getFullYear() - effectiveSinceDate.getFullYear()) * 12 +
        (endDate.getMonth() - effectiveSinceDate.getMonth());
      completeMonths = Math.max(0, monthsDiff);
    }
  }

  const alwaysExcludedCategories = ['Investment and Retirement Funds'];
  const { data: excludedCategoryRows } = await supabaseAdmin
    .from('system_categories')
    .select('id')
    .in('label', alwaysExcludedCategories);
  const excludedCategoryIds = excludedCategoryRows?.map((c) => c.id) || [];

  let query = supabaseAdmin
    .from('transactions')
    .select(
      `
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
    `
    )
    .eq('accounts.user_id', userId)
    .not('system_categories', 'is', null)
    .gte('date', effectiveSinceDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (endDate) {
    query = query.lt('date', endDate.toISOString().split('T')[0]);
  }

  if (excludedCategoryIds.length > 0) {
    query = query.not('category_id', 'in', `(${excludedCategoryIds.join(',')})`);
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error('Error fetching spending by category:', error);
    return Response.json({ error: 'Failed to fetch spending data' }, { status: 500 });
  }

  const txs = (transactions ?? []) as unknown as SpendingTx[];
  const { matchedIds } = identifyTransfers(txs as unknown as TransferShape[]);

  const categoryData: Record<string, CategoryDatum> = {};
  const groupBy = searchParams.get('groupBy');

  const consistentFilter = forBudget && searchParams.get('consistent') !== 'false';

  txs.forEach((transaction) => {
    if (matchedIds.has(transaction.id)) return;
    if (isTransfer(transaction as unknown as TransferShape)) return;
    if (transaction.transaction_repayments && transaction.transaction_repayments.length > 0)
      return;

    const category = transaction.system_categories;
    if (!category) return;

    let key: string;
    let label: string;
    let hex_color: string;
    let icon_name: string | null;
    let icon_lib: string | null;
    let group_id: string | null = null;
    let group_name: string | null = null;

    if (groupBy === 'group') {
      key = category.category_groups?.id || 'other';
      label = category.category_groups?.name || 'Other';
      hex_color = category.category_groups?.hex_color || '#6B7280';
      icon_name = category.category_groups?.icon_name ?? null;
      icon_lib = category.category_groups?.icon_lib ?? null;
    } else {
      key = category.id;
      label = category.label;
      hex_color = category.hex_color || category.category_groups?.hex_color || '#6B7280';
      icon_name = category.category_groups?.icon_name ?? null;
      icon_lib = category.category_groups?.icon_lib ?? null;
      group_id = category.category_groups?.id ?? null;
      group_name = category.category_groups?.name ?? null;
    }

    const rawAmount = Number(transaction.amount);

    if (type === 'spending' && rawAmount > 0) return;
    if (type === 'income' && rawAmount < 0) return;

    const settledReimbursement =
      transaction.transaction_splits?.reduce((sum: number, split) => {
        return split.is_settled ? sum + (Number(split.amount) || 0) : sum;
      }, 0) || 0;

    let adjustedAmount = 0;
    if (rawAmount < 0) {
      adjustedAmount = Math.max(0, Math.abs(rawAmount) - settledReimbursement);
    } else {
      adjustedAmount = rawAmount;
    }

    if (adjustedAmount === 0) return;

    const monthKey = (transaction.date || '').slice(0, 7);

    if (!categoryData[key]) {
      categoryData[key] = {
        id: key,
        label,
        hex_color,
        icon_name,
        icon_lib,
        group_id,
        group_name,
        total_spent: 0,
        transaction_count: 0,
        months_seen: new Set(),
      };
    }

    categoryData[key].total_spent += adjustedAmount;
    categoryData[key].transaction_count += 1;
    if (monthKey) categoryData[key].months_seen.add(monthKey);
  });

  const effectiveMonths = completeMonths > 0 ? completeMonths : 1;
  const consistencyThreshold = Math.max(1, Math.ceil(effectiveMonths * (2 / 3)));

  const categoriesArray = Object.values(categoryData)
    .map((c) => {
      const monthsWith = c.months_seen.size;
      const monthlyAvg = monthsWith > 0 ? Math.round(c.total_spent / monthsWith) : 0;
      return {
        id: c.id,
        label: c.label,
        hex_color: c.hex_color,
        icon_name: c.icon_name,
        icon_lib: c.icon_lib,
        group_id: c.group_id,
        group_name: c.group_name,
        total_spent: c.total_spent,
        transaction_count: c.transaction_count,
        months_with_spending: monthsWith,
        monthly_avg: monthlyAvg,
      };
    })
    .sort((a, b) => b.total_spent - a.total_spent);

  const totalSpending = categoriesArray.reduce((sum, category) => sum + category.total_spent, 0);

  const filteredCategories = categoriesArray
    .map((category) => ({
      ...category,
      percentage: totalSpending > 0 ? (category.total_spent / totalSpending) * 100 : 0,
      is_consistent: category.months_with_spending >= consistencyThreshold,
    }))
    .filter((category) => {
      if (category.percentage < minPercent) return false;
      if (consistentFilter && !category.is_consistent) return false;
      return true;
    });

  if (DEBUG)
    console.log(
      `📊 ${type} by Category: categories=${filteredCategories.length} completeMonths=${completeMonths} threshold=${consistencyThreshold}`,
      filteredCategories.slice(0, 3)
    );

  return Response.json({
    categories: filteredCategories,
    totalSpending,
    totalCategories: categoriesArray.length,
    filteredCount: filteredCategories.length,
    completeMonths: completeMonths || 1,
    consistencyThreshold,
  });
});
