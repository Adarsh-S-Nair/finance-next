import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';
import { identifyTransfers, isTransfer, type TransferShape } from '../../../../lib/transfer-matching';

interface MonthTx {
  id: string;
  amount: number;
  date: string | null;
  merchant_name: string | null;
  description: string;
  icon_url: string | null;
  accounts: { user_id: string };
  system_categories: {
    id: string;
    label: string;
    hex_color: string;
    category_groups: {
      name: string;
      icon_lib: string | null;
      icon_name: string | null;
      hex_color: string;
    } | null;
  } | null;
  transaction_splits: { amount: number; is_settled: boolean | null }[];
  transaction_repayments: { id: string }[];
}

interface DailySummary {
  income: number;
  spending: number;
}
interface DailyTxRecord {
  merchant: string;
  amount: number;
  icon_url: string | null;
  category_icon_lib: string | null;
  category_icon_name: string | null;
  category_hex_color: string | null;
}

interface MonthDay {
  day: number;
  dateString: string;
  income: number;
  spending: number;
  dailyIncome: number;
  dailySpending: number;
  transactions: DailyTxRecord[];
  moreCount: number;
}

async function getMonthData(
  userId: string,
  year: number,
  month: number,
  excludedCategoryIds: string[]
): Promise<{ daysInMonth: number; data: MonthDay[] } | null> {
  const endDate = new Date(year, month + 1, 0);
  const daysInMonth = endDate.getDate();

  const startDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

  let query = supabaseAdmin
    .from('transactions')
    .select(
      'id, amount, date, merchant_name, description, icon_url, accounts!inner(user_id), system_categories(id, label, hex_color, category_groups(name, icon_lib, icon_name, hex_color)), transaction_splits(amount, is_settled), transaction_repayments(id)'
    )
    .eq('accounts.user_id', userId)
    .gte('date', startDateStr)
    .lte('date', endDateStr)
    .order('date', { ascending: true });

  if (excludedCategoryIds.length > 0) {
    query = query.not('category_id', 'in', `(${excludedCategoryIds.join(',')})`);
  }

  const { data: transactions, error } = await query;

  if (error) {
    console.error('Error fetching transactions:', error);
    return null;
  }

  const txs = (transactions ?? []) as unknown as MonthTx[];
  const { matchedIds } = identifyTransfers(txs as unknown as TransferShape[]);

  const dailyTotals = new Map<number, DailySummary>();
  const dailyTransactions = new Map<number, DailyTxRecord[]>();
  for (let i = 1; i <= daysInMonth; i++) {
    dailyTotals.set(i, { income: 0, spending: 0 });
    dailyTransactions.set(i, []);
  }

  txs.forEach((tx) => {
    if (matchedIds.has(tx.id)) return;
    if (isTransfer(tx as unknown as TransferShape)) return;
    if (tx.transaction_repayments && tx.transaction_repayments.length > 0) return;
    if (!tx.date) return;

    const dayPart = parseInt(tx.date.split('-')[2]);

    const current = dailyTotals.get(dayPart);
    if (!current) return;

    const amount = Number(tx.amount);

    const settledReimbursement =
      tx.transaction_splits?.reduce((sum: number, split) => {
        return split.is_settled ? sum + (Number(split.amount) || 0) : sum;
      }, 0) || 0;

    if (amount > 0) {
      current.income += amount;
    } else if (amount < 0) {
      const adjustedSpending = Math.max(0, Math.abs(amount) - settledReimbursement);
      current.spending += adjustedSpending;
      const list = dailyTransactions.get(dayPart);
      if (list) {
        list.push({
          merchant: tx.merchant_name || tx.description || 'Transaction',
          amount: adjustedSpending,
          icon_url: tx.icon_url || null,
          category_icon_lib: tx.system_categories?.category_groups?.icon_lib || null,
          category_icon_name: tx.system_categories?.category_groups?.icon_name || null,
          category_hex_color:
            tx.system_categories?.hex_color ||
            tx.system_categories?.category_groups?.hex_color ||
            null,
        });
      }
    }
  });

  let cumulativeIncome = 0;
  let cumulativeSpending = 0;
  const result: MonthDay[] = [];

  for (let i = 1; i <= daysInMonth; i++) {
    const dayData = dailyTotals.get(i)!;
    cumulativeIncome += dayData.income;
    cumulativeSpending += dayData.spending;

    const dateObj = new Date(year, month, i);
    const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const dayTxs = (dailyTransactions.get(i) ?? []).sort((a, b) => b.amount - a.amount);
    const cappedTxs = dayTxs.slice(0, 5).map((t) => ({
      merchant: t.merchant,
      amount: Math.round(t.amount * 100) / 100,
      icon_url: t.icon_url,
      category_icon_lib: t.category_icon_lib,
      category_icon_name: t.category_icon_name,
      category_hex_color: t.category_hex_color,
    }));
    const moreCount = Math.max(0, dayTxs.length - 5);

    result.push({
      day: i,
      dateString,
      income: Math.round(cumulativeIncome),
      spending: Math.round(cumulativeSpending),
      dailyIncome: Math.round(dayData.income),
      dailySpending: Math.round(dayData.spending),
      transactions: cappedTxs,
      moreCount,
    });
  }

  return { daysInMonth, data: result };
}

export const GET = withAuth('monthly-overview', async (request, userId) => {
  const { searchParams } = new URL(request.url);

  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthParam = parseInt(searchParams.get('month') ?? '');
  const yearParam = parseInt(searchParams.get('year') ?? '');
  const month = Number.isFinite(monthParam) ? monthParam : currentMonth;
  const year = Number.isFinite(yearParam) ? yearParam : currentYear;

  const isCurrentMonth = month === currentMonth && year === currentYear;

  let prevMonth = month - 1;
  let prevYear = year;
  if (prevMonth < 0) {
    prevMonth = 11;
    prevYear = year - 1;
  }

  const alwaysExcludedCategories = ['Investment and Retirement Funds'];
  const { data: excludedCategoryRows } = await supabaseAdmin
    .from('system_categories')
    .select('id')
    .in('label', alwaysExcludedCategories);
  const excludedCategoryIds = excludedCategoryRows?.map((c) => c.id) || [];

  const [currentMonthResult, prevMonthResult] = await Promise.all([
    getMonthData(userId, year, month, excludedCategoryIds),
    getMonthData(userId, prevYear, prevMonth, excludedCategoryIds),
  ]);

  if (!currentMonthResult) {
    return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }

  const prevMonthName = new Date(prevYear, prevMonth, 1).toLocaleDateString('en-US', {
    month: 'long',
  });

  const maxDays = currentMonthResult.daysInMonth;

  const prevMonthFinalSpending = prevMonthResult?.data.length
    ? prevMonthResult.data[prevMonthResult.data.length - 1].spending
    : null;

  interface MergedDay {
    day: number;
    dateString: string;
    spending: number | null;
    income: number | null;
    dailySpending: number | null;
    dailyIncome: number | null;
    previousSpending: number | null;
    transactions: DailyTxRecord[];
    moreCount: number;
  }

  const mergedData: MergedDay[] = [];
  for (let day = 1; day <= maxDays; day++) {
    const currentDayData = currentMonthResult.data.find((d) => d.day === day);
    const prevDayData = prevMonthResult?.data.find((d) => d.day === day);

    let spending: number | null = null;
    let income: number | null = null;
    let dailySpending: number | null = null;
    let dailyIncome: number | null = null;
    let transactions: DailyTxRecord[] = [];
    let moreCount = 0;

    if (currentDayData) {
      if (isCurrentMonth) {
        if (day <= currentDay) {
          spending = currentDayData.spending;
          income = currentDayData.income;
          dailySpending = currentDayData.dailySpending;
          dailyIncome = currentDayData.dailyIncome;
          transactions = currentDayData.transactions || [];
          moreCount = currentDayData.moreCount || 0;
        }
      } else {
        spending = currentDayData.spending;
        income = currentDayData.income;
        dailySpending = currentDayData.dailySpending;
        dailyIncome = currentDayData.dailyIncome;
        transactions = currentDayData.transactions || [];
        moreCount = currentDayData.moreCount || 0;
      }
    }

    let previousSpending: number | null;
    if (prevDayData) {
      if (
        day === maxDays &&
        prevMonthResult &&
        prevMonthResult.daysInMonth > maxDays &&
        prevMonthFinalSpending !== null
      ) {
        previousSpending = prevMonthFinalSpending;
      } else {
        previousSpending = prevDayData.spending;
      }
    } else if (
      prevMonthResult &&
      day > prevMonthResult.daysInMonth &&
      prevMonthFinalSpending !== null
    ) {
      previousSpending = prevMonthFinalSpending;
    } else {
      previousSpending = null;
    }

    const dateObj = new Date(year, month, day);
    const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    mergedData.push({
      day,
      dateString,
      spending,
      income,
      dailySpending,
      dailyIncome,
      previousSpending,
      transactions,
      moreCount,
    });
  }

  return Response.json({
    data: mergedData,
    previousMonthName: prevMonthName,
    previousMonthDays: prevMonthResult?.daysInMonth || 0,
    isCurrentMonth,
    currentDay: isCurrentMonth ? currentDay : null,
  });
});
