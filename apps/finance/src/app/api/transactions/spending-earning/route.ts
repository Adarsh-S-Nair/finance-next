import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';
import { identifyTransfers, isTransfer, type TransferShape } from '../../../../lib/transfer-matching';
const DEBUG =
  process.env.NODE_ENV !== 'production' && process.env.DEBUG_API_LOGS === '1';

interface SETx {
  id: string;
  amount: number;
  date: string | null;
  accounts: { user_id: string };
  system_categories: {
    id: string;
    label: string;
    category_groups: { name: string } | null;
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

export const GET = withAuth('spending-earning', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const monthsParam = parseInt(searchParams.get('months') || '24', 10);
  const MAX_MONTHS =
    Number.isFinite(monthsParam) && monthsParam > 0 ? Math.min(monthsParam, 36) : 24;

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

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - MAX_MONTHS);
  sinceDate.setDate(1);

  const alwaysExcludedCategories = ['Investment and Retirement Funds'];
  const { data: excludedCategoryRows } = await supabaseAdmin
    .from('system_categories')
    .select('id')
    .in('label', alwaysExcludedCategories);

  let excludedCategoryIds = excludedCategoryRows?.map((c) => c.id) || [];

  const includeCategoryIdsParam = searchParams.get('includeCategoryIds');
  const excludeCategoryIdsParam = searchParams.get('excludeCategoryIds');

  if (excludeCategoryIdsParam) {
    const additionalExcludedIds = excludeCategoryIdsParam.split(',');
    excludedCategoryIds = [...excludedCategoryIds, ...additionalExcludedIds];
  }

  let query = supabaseAdmin
    .from('transactions')
    .select(
      `
      id,
      amount,
      date,
      accounts!inner (
        user_id
      ),
      system_categories (
        id,
        label,
        category_groups (
          name
        )
      ),
      transaction_splits (
        amount,
        is_settled
      ),
      transaction_repayments (
        id
      )
    `
    )
    .eq('accounts.user_id', userId)
    .not('date', 'is', null)
    .gte('date', sinceDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (excludedCategoryIds.length > 0) {
    query = query.not('category_id', 'in', `(${excludedCategoryIds.join(',')})`);
  }

  if (includeCategoryIdsParam) {
    query = query.in('category_id', includeCategoryIdsParam.split(','));
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error('Error fetching transactions:', error);
    return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  const txs = (transactions ?? []) as unknown as SETx[];
  const { matchedIds } = identifyTransfers(txs as unknown as TransferShape[]);

  const monthlyData: Record<string, MonthlyDatum> = {};

  txs.forEach((transaction) => {
    if (matchedIds.has(transaction.id)) return;
    if (isTransfer(transaction as unknown as TransferShape)) return;
    if (transaction.transaction_repayments && transaction.transaction_repayments.length > 0) return;
    if (!transaction.date) return;

    const [yearStr, monthStr] = transaction.date.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const monthKey = `${yearStr}-${monthStr}`;

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

    const amount = Number(transaction.amount);

    const settledReimbursement =
      transaction.transaction_splits?.reduce((sum: number, split) => {
        return split.is_settled ? sum + (Number(split.amount) || 0) : sum;
      }, 0) || 0;

    monthlyData[monthKey].transactionCount++;

    let adjustedAmount = 0;

    if (amount < 0) {
      const adjustedSpending = Math.max(0, Math.abs(amount) - settledReimbursement);
      monthlyData[monthKey].spending += adjustedSpending;
      adjustedAmount = -adjustedSpending;
    } else if (amount > 0) {
      monthlyData[monthKey].earning += amount;
      adjustedAmount = amount;
    }

    monthlyData[monthKey].netAmount += adjustedAmount;
  });

  const monthlyArray = Object.values(monthlyData).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthNumber - b.monthNumber;
  });

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const result = monthlyArray.map((month) => ({
    ...month,
    monthName: monthNames[month.monthNumber - 1],
    formattedMonth: `${monthNames[month.monthNumber - 1]} ${month.year}`,
  }));

  const nowForExclusion = new Date();
  const currentYearForExclusion = nowForExclusion.getFullYear();
  const currentMonthForExclusion = nowForExclusion.getMonth() + 1;

  const processedMonths = result
    .map((month) => {
      const isCurrentMonth =
        month.year === currentYearForExclusion &&
        month.monthNumber === currentMonthForExclusion;

      let isIncompleteFirstMonth = false;
      if (firstCompleteMonthStart) {
        const monthStart = new Date(month.year, month.monthNumber - 1, 1);
        if (monthStart < firstCompleteMonthStart) {
          isIncompleteFirstMonth = true;
        }
      }

      return {
        ...month,
        isCurrentMonth,
        isIncompleteFirstMonth,
        isComplete: !isCurrentMonth && !isIncompleteFirstMonth,
      };
    })
    .filter((month) => !month.isIncompleteFirstMonth || month.isCurrentMonth);

  const completedMonths = processedMonths.filter((month) => month.isComplete);
  const limitedCompletedMonths = completedMonths.slice(-MAX_MONTHS);

  const currentMonth = processedMonths.find((m) => m.isCurrentMonth);
  const limitedResult = currentMonth
    ? [...limitedCompletedMonths, currentMonth]
    : limitedCompletedMonths;

  console.log(
    `[spending-earning] Calculation for userId=${userId}, requested months=${MAX_MONTHS}`
  );
  console.log(`[spending-earning] Total transactions fetched: ${txs.length}`);
  console.log(`[spending-earning] Matched transfers (excluded): ${matchedIds.size}`);
  const transferCount = txs.filter(
    (tx) => isTransfer(tx as unknown as TransferShape) && !matchedIds.has(tx.id)
  ).length;
  console.log(`[spending-earning] Unmatched transfers (excluded): ${transferCount}`);
  console.log(`[spending-earning] Total monthly data entries: ${result.length}`);
  console.log(
    `[spending-earning] Current month (${monthNames[currentMonthForExclusion - 1]} ${currentYearForExclusion}) excluded from calculation`
  );
  console.log(`[spending-earning] Completed months available: ${completedMonths.length}`);
  result.forEach((month) => {
    const isCurrentMonth =
      month.year === currentYearForExclusion && month.monthNumber === currentMonthForExclusion;
    const status = isCurrentMonth ? '[CURRENT - EXCLUDED]' : '';
    console.log(
      `[spending-earning] ${month.monthName} ${month.year} ${status}: earning=$${month.earning.toFixed(2)}, spending=$${month.spending.toFixed(2)}, transactions=${month.transactionCount}`
    );
  });
  console.log(
    `[spending-earning] Using last ${MAX_MONTHS} completed months: ${limitedResult.length} months`
  );
  limitedResult.forEach((month) => {
    console.log(
      `[spending-earning]   - ${month.monthName} ${month.year}: earning=$${month.earning.toFixed(2)}`
    );
  });
  const totalEarning = limitedResult.reduce((sum, month) => sum + month.earning, 0);
  const avgEarning = limitedResult.length > 0 ? totalEarning / limitedResult.length : 0;
  console.log(
    `[spending-earning] Total earning (${limitedResult.length} months): $${totalEarning.toFixed(2)}`
  );
  console.log(
    `[spending-earning] Average monthly earning: $${avgEarning.toFixed(2)}`
  );

  if (DEBUG)
    console.log(
      `📊 Monthly Spending & Earning: months=${limitedResult.length} (cap=${MAX_MONTHS})`
    );

  // ── Month-over-Month (MoM) ──
  const nowForMoM = new Date();
  const currentMonthForMoM = nowForMoM.getMonth();
  const currentYearForMoM = nowForMoM.getFullYear();
  const currentDayForMoM = nowForMoM.getDate();

  const lastMonthDate = new Date(nowForMoM);
  lastMonthDate.setMonth(nowForMoM.getMonth() - 1);
  const lastMonth = lastMonthDate.getMonth();
  const lastMonthYear = lastMonthDate.getFullYear();

  const daysInLastMonth = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
  const comparisonDay = Math.min(currentDayForMoM, daysInLastMonth);

  let currentMonthIncome = 0;
  let currentMonthSpending = 0;
  let lastMonthIncome = 0;
  let lastMonthSpending = 0;

  txs.forEach((tx) => {
    if (matchedIds.has(tx.id)) return;
    if (isTransfer(tx as unknown as TransferShape)) return;
    if (tx.transaction_repayments && tx.transaction_repayments.length > 0) return;
    if (!tx.date) return;

    const [yStr, mStr, dStr] = tx.date.split('-');
    const year = parseInt(yStr);
    const month = parseInt(mStr) - 1;
    const day = parseInt(dStr);
    const amount = Number(tx.amount);

    const settledReimbursement =
      tx.transaction_splits?.reduce((sum: number, split) => {
        return split.is_settled ? sum + (Number(split.amount) || 0) : sum;
      }, 0) || 0;

    if (year === currentYearForMoM && month === currentMonthForMoM && day <= currentDayForMoM) {
      if (amount > 0) currentMonthIncome += amount;
      else currentMonthSpending += Math.max(0, Math.abs(amount) - settledReimbursement);
    }

    if (year === lastMonthYear && month === lastMonth && day <= comparisonDay) {
      if (amount > 0) lastMonthIncome += amount;
      else lastMonthSpending += Math.max(0, Math.abs(amount) - settledReimbursement);
    }
  });

  const incomeChange =
    lastMonthIncome === 0 ? 0 : ((currentMonthIncome - lastMonthIncome) / lastMonthIncome) * 100;
  const spendingChange =
    lastMonthSpending === 0
      ? 0
      : ((currentMonthSpending - lastMonthSpending) / lastMonthSpending) * 100;

  if (DEBUG)
    console.log(
      `📊 MoM Comparison: Income ${incomeChange.toFixed(1)}%, Spending ${spendingChange.toFixed(1)}%`
    );

  return Response.json({
    data: limitedResult,
    summary: {
      totalMonths: limitedResult.length,
      totalSpending: limitedResult.reduce((sum, month) => sum + month.spending, 0),
      totalEarning: limitedResult.reduce((sum, month) => sum + month.earning, 0),
      totalTransactions: limitedResult.reduce((sum, month) => sum + month.transactionCount, 0),
    },
    momComparison: {
      incomeChange,
      spendingChange,
      currentMonthIncome,
      lastMonthIncome,
      currentMonthSpending,
      lastMonthSpending,
    },
  });
});
