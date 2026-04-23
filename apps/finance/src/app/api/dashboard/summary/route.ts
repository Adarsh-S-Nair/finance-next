/**
 * GET /api/dashboard/summary
 *
 * Fetches transactions once and returns both spendingEarning (monthly chart) and
 * spendingByCategory (donut chart) data used by the main dashboard.
 *
 * Query params:
 *   months          {number}  - months of history for spending-earning chart (default 6, max 36)
 *   categoryPeriod  'thisMonth'|'last30' - period for spending-by-category (default 'thisMonth')
 */

import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';
import { identifyTransfers, isTransfer, type TransferShape } from '../../../../lib/transfer-matching';

interface SummaryTx {
  id: string;
  amount: number;
  date: string | null;
  accounts: { user_id: string };
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
}

interface MonthlyDatum {
  month: string;
  year: number;
  monthNumber: number;
  spending: number;
  earning: number;
  netAmount: number;
  transactionCount: number;
}

interface CategoryDatum {
  id: string;
  label: string;
  hex_color: string;
  icon_name: string | null;
  icon_lib: string | null;
  total_spent: number;
  transaction_count: number;
}

export const GET = withAuth('dashboard:summary', async (request, userId) => {
  const { searchParams } = new URL(request.url);

  const monthsParam = parseInt(searchParams.get('months') || '6', 10);
  const MAX_MONTHS =
    Number.isFinite(monthsParam) && monthsParam > 0 ? Math.min(monthsParam, 36) : 6;
  const categoryPeriod = searchParams.get('categoryPeriod') || 'thisMonth';

  const now = new Date();
  const chartSince = new Date(now.getFullYear(), now.getMonth() - MAX_MONTHS, 1);

  let categorySince: Date;
  let categoryEndDate: Date | null = null;
  if (categoryPeriod === 'last30') {
    categorySince = new Date();
    categorySince.setDate(categorySince.getDate() - 30);
  } else {
    categorySince = new Date(now.getFullYear(), now.getMonth(), 1);
    categoryEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const fetchSince = chartSince < categorySince ? chartSince : categorySince;

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
      accounts!inner(user_id),
      system_categories(
        id,
        label,
        hex_color,
        category_groups(
          id,
          name,
          hex_color,
          icon_lib,
          icon_name
        )
      ),
      transaction_splits(amount, is_settled),
      transaction_repayments(id)
    `
    )
    .eq('accounts.user_id', userId)
    .not('date', 'is', null)
    .gte('date', fetchSince.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (excludedCategoryIds.length > 0) {
    query = query.not('category_id', 'in', `(${excludedCategoryIds.join(',')})`);
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error('[dashboard/summary] Error fetching transactions:', error);
    return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  const txs = (transactions ?? []) as unknown as SummaryTx[];
  const { matchedIds } = identifyTransfers(txs as unknown as TransferShape[]);

  const spendingEarning = buildSpendingEarning(txs, matchedIds, MAX_MONTHS, now);
  const spendingByCategory = buildSpendingByCategory(
    txs,
    matchedIds,
    categorySince,
    categoryEndDate
  );

  return Response.json({ spendingEarning, spendingByCategory });
});

function buildSpendingEarning(
  transactions: SummaryTx[],
  matchedIds: Set<string>,
  MAX_MONTHS: number,
  now: Date
) {
  const monthlyData: Record<string, MonthlyDatum> = {};
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let firstCompleteMonthStart: Date | null = null;
  const sorted = transactions
    .filter((tx): tx is SummaryTx & { date: string } => Boolean(tx.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length > 0) {
    const earliest = new Date(sorted[0].date);
    if (earliest.getDate() > 1) {
      firstCompleteMonthStart = new Date(earliest.getFullYear(), earliest.getMonth() + 1, 1);
    } else {
      firstCompleteMonthStart = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    }
  }

  transactions.forEach((tx) => {
    if (matchedIds.has(tx.id)) return;
    if (isTransfer(tx as unknown as TransferShape)) return;
    if (tx.transaction_repayments?.length > 0) return;
    if (!tx.date) return;

    const [yearStr, monthStr] = tx.date.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const monthKey = `${yearStr}-${monthStr}`;
    const amount = Number(tx.amount);

    const settledReimbursement =
      tx.transaction_splits?.reduce((sum: number, split) => {
        return split.is_settled ? sum + (Number(split.amount) || 0) : sum;
      }, 0) || 0;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        year,
        monthNumber: month,
        spending: 0,
        earning: 0,
        netAmount: 0,
        transactionCount: 0,
      };
    }

    monthlyData[monthKey].transactionCount++;
    if (amount < 0) {
      const adjustedSpending = Math.max(0, Math.abs(amount) - settledReimbursement);
      monthlyData[monthKey].spending += adjustedSpending;
      monthlyData[monthKey].netAmount -= adjustedSpending;
    } else if (amount > 0) {
      monthlyData[monthKey].earning += amount;
      monthlyData[monthKey].netAmount += amount;
    }
  });

  const result = Object.values(monthlyData)
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.monthNumber - b.monthNumber))
    .map((m) => ({
      ...m,
      monthName: monthNames[m.monthNumber - 1],
      formattedMonth: `${monthNames[m.monthNumber - 1]} ${m.year}`,
      isCurrentMonth: m.year === currentYear && m.monthNumber === currentMonth,
      isComplete:
        !(m.year === currentYear && m.monthNumber === currentMonth) &&
        (!firstCompleteMonthStart ||
          new Date(m.year, m.monthNumber - 1, 1) >= firstCompleteMonthStart),
    }));

  const completedMonths = result.filter((m) => m.isComplete).slice(-MAX_MONTHS);
  const currentMonthEntry = result.find((m) => m.isCurrentMonth);
  const limitedResult = currentMonthEntry
    ? [...completedMonths, currentMonthEntry]
    : completedMonths;

  return {
    data: limitedResult,
    summary: {
      totalMonths: limitedResult.length,
      totalSpending: limitedResult.reduce((s, m) => s + m.spending, 0),
      totalEarning: limitedResult.reduce((s, m) => s + m.earning, 0),
      totalTransactions: limitedResult.reduce((s, m) => s + m.transactionCount, 0),
    },
  };
}

function buildSpendingByCategory(
  transactions: SummaryTx[],
  matchedIds: Set<string>,
  since: Date,
  endDate: Date | null
) {
  const sinceStr = since.toISOString().split('T')[0];
  const endStr = endDate ? endDate.toISOString().split('T')[0] : null;
  const categoryData: Record<string, CategoryDatum> = {};

  transactions.forEach((tx) => {
    if (!tx.date) return;
    if (tx.date < sinceStr) return;
    if (endStr && tx.date > endStr) return;
    if (matchedIds.has(tx.id)) return;
    if (isTransfer(tx as unknown as TransferShape)) return;
    if (tx.transaction_repayments?.length > 0) return;

    const category = tx.system_categories;
    if (!category) return;

    const rawAmount = Number(tx.amount);
    if (rawAmount >= 0) return;

    const settledReimbursement =
      tx.transaction_splits?.reduce((sum: number, split) => {
        return split.is_settled ? sum + (Number(split.amount) || 0) : sum;
      }, 0) || 0;

    const adjustedAmount = Math.max(0, Math.abs(rawAmount) - settledReimbursement);
    if (adjustedAmount === 0) return;

    const key = category.id;
    if (!categoryData[key]) {
      categoryData[key] = {
        id: key,
        label: category.label,
        hex_color: category.hex_color || category.category_groups?.hex_color || '#6B7280',
        icon_name: category.category_groups?.icon_name ?? null,
        icon_lib: category.category_groups?.icon_lib ?? null,
        total_spent: 0,
        transaction_count: 0,
      };
    }

    categoryData[key].total_spent += adjustedAmount;
    categoryData[key].transaction_count += 1;
  });

  const categoriesArray = Object.values(categoryData).sort(
    (a, b) => b.total_spent - a.total_spent
  );
  const totalSpending = categoriesArray.reduce((sum, c) => sum + c.total_spent, 0);
  const categories = categoriesArray.map((c) => ({
    ...c,
    percentage: totalSpending > 0 ? (c.total_spent / totalSpending) * 100 : 0,
  }));

  return {
    categories,
    totalSpending,
    totalCategories: categoriesArray.length,
    filteredCount: categories.length,
  };
}
