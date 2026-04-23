import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';

interface MonthlyDatum {
  month: string;
  year: number;
  monthNumber: number;
  spending: number;
  transactionCount: number;
  earliestDay: number;
  latestDay: number;
}

export const GET = withAuth('category-history', async (request, userId) => {
  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get('categoryId');
  const categoryGroupId = searchParams.get('categoryGroupId');
  const monthsParam = parseInt(searchParams.get('months') || '4', 10);
  const MAX_MONTHS =
    Number.isFinite(monthsParam) && monthsParam > 0 ? Math.min(monthsParam, 12) : 4;

  if (!categoryId && !categoryGroupId) {
    return Response.json(
      { error: 'Either categoryId or categoryGroupId is required' },
      { status: 400 }
    );
  }

  let scopedCategoryIds: string[] | null = null;
  if (categoryGroupId) {
    const { data: groupCats, error: groupErr } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .eq('group_id', categoryGroupId);
    if (groupErr) {
      console.error('Error fetching group categories:', groupErr);
      return Response.json({ error: 'Failed to fetch category group' }, { status: 500 });
    }
    scopedCategoryIds = (groupCats || []).map((c) => c.id);
    if (scopedCategoryIds.length === 0) {
      return Response.json({ data: [], categoryGroupId, totalMonths: 0 });
    }
  }

  const sinceDate = new Date();
  sinceDate.setMonth(sinceDate.getMonth() - MAX_MONTHS);
  sinceDate.setDate(1);

  const { data: earliestTxResult } = await supabaseAdmin
    .from('transactions')
    .select('date, accounts!inner(user_id)')
    .eq('accounts.user_id', userId)
    .order('date', { ascending: true })
    .limit(1);

  const earliestTransactionDate = earliestTxResult?.[0]?.date
    ? new Date(earliestTxResult[0].date)
    : null;

  let txQuery = supabaseAdmin
    .from('transactions')
    .select(
      `
      id,
      amount,
      date,
      category_id,
      transaction_splits (
        amount,
        is_settled
      ),
      accounts!inner (
        user_id
      )
    `
    )
    .eq('accounts.user_id', userId)
    .gte('date', sinceDate.toISOString().split('T')[0])
    .lt('amount', 0)
    .order('date', { ascending: true });

  if (scopedCategoryIds) {
    txQuery = txQuery.in('category_id', scopedCategoryIds);
  } else if (categoryId) {
    txQuery = txQuery.eq('category_id', categoryId);
  }

  const { data: transactions, error } = await txQuery;

  if (error) {
    console.error('Error fetching category history:', error);
    return Response.json({ error: 'Failed to fetch category history' }, { status: 500 });
  }

  const monthlyData: Record<string, MonthlyDatum> = {};

  (transactions ?? []).forEach((tx) => {
    if (!tx.date) return;

    const [yearStr, monthStr, dayStr] = tx.date.split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const day = parseInt(dayStr);
    const monthKey = `${yearStr}-${monthStr}`;

    const rawAmount = Math.abs(Number(tx.amount));

    const settledReimbursement =
      tx.transaction_splits?.reduce(
        (sum: number, split: { amount: number; is_settled: boolean | null }) => {
          return split.is_settled ? sum + (Number(split.amount) || 0) : sum;
        },
        0
      ) || 0;

    const adjustedAmount = Math.max(0, rawAmount - settledReimbursement);
    if (adjustedAmount === 0) return;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        year,
        monthNumber: month,
        spending: 0,
        transactionCount: 0,
        earliestDay: day,
        latestDay: day,
      };
    }

    monthlyData[monthKey].spending += adjustedAmount;
    monthlyData[monthKey].transactionCount += 1;
    monthlyData[monthKey].earliestDay = Math.min(monthlyData[monthKey].earliestDay, day);
    monthlyData[monthKey].latestDay = Math.max(monthlyData[monthKey].latestDay, day);
  });

  const monthlyArray = Object.values(monthlyData).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthNumber - b.monthNumber;
  });

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const completedMonths = monthlyArray
    .filter((m) => {
      if (m.year === currentYear && m.monthNumber === currentMonth) {
        return false;
      }

      if (earliestTransactionDate) {
        const monthStart = new Date(m.year, m.monthNumber - 1, 1);
        const earliestMonth = new Date(
          earliestTransactionDate.getFullYear(),
          earliestTransactionDate.getMonth(),
          1
        );
        if (earliestTransactionDate.getDate() > 1) {
          if (monthStart <= earliestMonth) {
            return false;
          }
        } else {
          if (monthStart < earliestMonth) {
            return false;
          }
        }
      }

      return true;
    })
    .slice(-MAX_MONTHS);

  const result = completedMonths.map((m) => ({
    ...m,
    monthName: monthNames[m.monthNumber - 1],
    spending: Math.round(m.spending),
  }));

  const scopeLabel = categoryGroupId ? `group ${categoryGroupId}` : `category ${categoryId}`;
  console.log(`[category-history] ${scopeLabel}: ${result.length} months of data`);

  return Response.json({
    data: result,
    categoryId: categoryId || null,
    categoryGroupId: categoryGroupId || null,
    totalMonths: result.length,
  });
});
