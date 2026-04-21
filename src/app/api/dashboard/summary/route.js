/**
 * GET /api/dashboard/summary
 *
 * Fetches transactions once and returns both spendingEarning (monthly chart) and
 * spendingByCategory (donut chart) data used by the main dashboard.
 *
 * Query params:
 *   months      {number}  - months of history for spending-earning chart (default 6, max 36)
 *   categoryPeriod {'thisMonth'|'last30'} - period for spending-by-category (default 'thisMonth')
 */

import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';
import { identifyTransfers, isTransfer } from '../../../../lib/transfer-matching';

export async function GET(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const { searchParams } = new URL(request.url);

    // ── Params ──────────────────────────────────────────────────────────────
    const monthsParam = parseInt(searchParams.get('months') || '6', 10);
    const MAX_MONTHS = Number.isFinite(monthsParam) && monthsParam > 0 ? Math.min(monthsParam, 36) : 6;
    const categoryPeriod = searchParams.get('categoryPeriod') || 'thisMonth'; // 'thisMonth' | 'last30'

    // ── Date ranges ─────────────────────────────────────────────────────────
    const now = new Date();

    // Oldest date we need: start of month MAX_MONTHS ago
    const chartSince = new Date(now.getFullYear(), now.getMonth() - MAX_MONTHS, 1);

    // Category window
    let categorySince;
    let categoryEndDate = null; // inclusive
    if (categoryPeriod === 'last30') {
      categorySince = new Date();
      categorySince.setDate(categorySince.getDate() - 30);
    } else {
      // 'thisMonth'
      categorySince = new Date(now.getFullYear(), now.getMonth(), 1);
      categoryEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // We need data going back as far as the chart window
    const fetchSince = chartSince < categorySince ? chartSince : categorySince;

    // ── Excluded categories ──────────────────────────────────────────────────
    const alwaysExcludedCategories = ['Investment and Retirement Funds'];
    const { data: excludedCategoryRows } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .in('label', alwaysExcludedCategories);
    const excludedCategoryIds = excludedCategoryRows?.map(c => c.id) || [];

    // ── Single transaction fetch ─────────────────────────────────────────────
    let query = supabaseAdmin
      .from('transactions')
      .select(`
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
      `)
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

    // ── Identify transfers (once) ────────────────────────────────────────────
    const { matchedIds } = identifyTransfers(transactions);

    // ── Build spendingEarning (monthly chart) ────────────────────────────────
    const spendingEarning = buildSpendingEarning(
      transactions,
      matchedIds,
      MAX_MONTHS,
      now
    );

    // ── Build spendingByCategory (donut chart) ───────────────────────────────
    const spendingByCategory = buildSpendingByCategory(
      transactions,
      matchedIds,
      categorySince,
      categoryEndDate
    );

    return Response.json({ spendingEarning, spendingByCategory });

  } catch (error) {
    if (error instanceof Response) return error;
    console.error('[dashboard/summary] Unexpected error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildSpendingEarning(transactions, matchedIds, MAX_MONTHS, now) {
  const monthlyData = {};
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Determine earliest-transaction date for incomplete-month filtering
  let firstCompleteMonthStart = null;
  const sorted = transactions.filter(tx => tx.date).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length > 0) {
    const earliest = new Date(sorted[0].date);
    if (earliest.getDate() > 1) {
      firstCompleteMonthStart = new Date(earliest.getFullYear(), earliest.getMonth() + 1, 1);
    } else {
      firstCompleteMonthStart = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    }
  }

  transactions.forEach(tx => {
    if (matchedIds.has(tx.id)) return;
    if (isTransfer(tx)) return;
    if (tx.transaction_repayments?.length > 0) return;
    if (!tx.date) return;

    const [yearStr, monthStr] = tx.date.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const monthKey = `${yearStr}-${monthStr}`;
    const amount = parseFloat(tx.amount);

    const settledReimbursement = tx.transaction_splits?.reduce((sum, split) => {
      return split.is_settled ? sum + (parseFloat(split.amount) || 0) : sum;
    }, 0) || 0;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { month: monthKey, year, monthNumber: month, spending: 0, earning: 0, netAmount: 0, transactionCount: 0 };
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
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.monthNumber - b.monthNumber)
    .map(m => ({
      ...m,
      monthName: monthNames[m.monthNumber - 1],
      formattedMonth: `${monthNames[m.monthNumber - 1]} ${m.year}`,
      isCurrentMonth: m.year === currentYear && m.monthNumber === currentMonth,
      isComplete: !(m.year === currentYear && m.monthNumber === currentMonth) &&
        (!firstCompleteMonthStart || new Date(m.year, m.monthNumber - 1, 1) >= firstCompleteMonthStart)
    }));

  const completedMonths = result.filter(m => m.isComplete).slice(-MAX_MONTHS);
  const currentMonthEntry = result.find(m => m.isCurrentMonth);
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
    }
  };
}

function buildSpendingByCategory(transactions, matchedIds, since, endDate) {
  const sinceStr = since.toISOString().split('T')[0];
  const endStr = endDate ? endDate.toISOString().split('T')[0] : null;
  const categoryData = {};

  transactions.forEach(tx => {
    if (!tx.date) return;
    if (tx.date < sinceStr) return;
    if (endStr && tx.date > endStr) return;
    if (matchedIds.has(tx.id)) return;
    if (isTransfer(tx)) return;
    if (tx.transaction_repayments?.length > 0) return;

    const category = tx.system_categories;
    if (!category) return;

    const rawAmount = parseFloat(tx.amount);
    if (rawAmount >= 0) return; // spending only

    const settledReimbursement = tx.transaction_splits?.reduce((sum, split) => {
      return split.is_settled ? sum + (parseFloat(split.amount) || 0) : sum;
    }, 0) || 0;

    const adjustedAmount = Math.max(0, Math.abs(rawAmount) - settledReimbursement);
    if (adjustedAmount === 0) return;

    const key = category.id;
    if (!categoryData[key]) {
      categoryData[key] = {
        id: key,
        label: category.label,
        hex_color: category.hex_color || category.category_groups?.hex_color || '#6B7280',
        icon_name: category.category_groups?.icon_name,
        icon_lib: category.category_groups?.icon_lib,
        total_spent: 0,
        transaction_count: 0
      };
    }

    categoryData[key].total_spent += adjustedAmount;
    categoryData[key].transaction_count += 1;
  });

  const categoriesArray = Object.values(categoryData).sort((a, b) => b.total_spent - a.total_spent);
  const totalSpending = categoriesArray.reduce((sum, c) => sum + c.total_spent, 0);
  // Return every category — TopCategoriesCard shows the top 5 individually and
  // buckets the remainder into "Other". Filtering sub-1% here would silently
  // hide the 3rd/4th/5th categories for users whose spend is concentrated.
  const categories = categoriesArray
    .map(c => ({
      ...c,
      percentage: totalSpending > 0 ? (c.total_spent / totalSpending) * 100 : 0
    }));

  return {
    categories,
    totalSpending,
    totalCategories: categoriesArray.length,
    filteredCount: categories.length
  };
}
