import { requireVerifiedUserId } from '../../../../lib/api/auth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { canAccess } from '../../../../lib/tierConfig';
import { identifyTransfers, isTransfer } from '../../../../lib/transfer-matching';
import { getBudgetProgress } from '../../../../lib/spending';
import { spendingPace } from '../../../../lib/insights/generators/spendingPace';
import { budgetAlert } from '../../../../lib/insights/generators/budgetAlert';
import { upcomingBills } from '../../../../lib/insights/generators/upcomingBills';
import { topCategoryShift } from '../../../../lib/insights/generators/topCategoryShift';
import type { Insight } from '../../../../lib/insights/types';

export async function GET(request: Request) {
  let userId: string;
  try {
    userId = requireVerifiedUserId(request);
  } catch (err) {
    if (err instanceof Response) return err;
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch user tier
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    const tier = userProfile?.subscription_tier || 'free';

    // Date ranges for transaction query
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();

    // We need current month + last month for MoM, plus a few prior months for category average
    const fetchSince = new Date(currentYear, currentMonth - 6, 1);

    // Excluded categories
    const { data: excludedRows } = await supabaseAdmin
      .from('system_categories')
      .select('id')
      .in('label', ['Investment and Retirement Funds']);
    const excludedIds = excludedRows?.map((c: { id: string }) => c.id) || [];

    // Single transaction fetch
    let query = supabaseAdmin
      .from('transactions')
      .select(`
        id,
        amount,
        date,
        accounts!inner(user_id),
        system_categories(id, label, hex_color, category_groups(id, name, hex_color)),
        transaction_splits(amount, is_settled),
        transaction_repayments(id)
      `)
      .eq('accounts.user_id', userId)
      .not('date', 'is', null)
      .gte('date', fetchSince.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (excludedIds.length > 0) {
      query = query.not('category_id', 'in', `(${excludedIds.join(',')})`);
    }

    const { data: transactions, error: txError } = await query;
    if (txError) {
      console.error('[insights] transaction fetch error:', txError);
      return Response.json({ error: 'Failed to fetch data' }, { status: 500 });
    }

    const { matchedIds } = identifyTransfers(transactions || []);

    // ── Compute MoM spending comparison ──
    const lastMonthDate = new Date(now);
    lastMonthDate.setMonth(currentMonth - 1);
    const lastMonth = lastMonthDate.getMonth();
    const lastMonthYear = lastMonthDate.getFullYear();
    const daysInLastMonth = new Date(lastMonthYear, lastMonth + 1, 0).getDate();
    const comparisonDay = Math.min(currentDay, daysInLastMonth);

    let currentMonthSpending = 0;
    let lastMonthSpending = 0;

    // ── Compute monthly spending + current month categories ──
    const monthlySpending: Record<string, number> = {};
    const currentMonthCategories: Record<string, { label: string; total: number }> = {};

    for (const tx of transactions || []) {
      if (matchedIds.has(tx.id)) continue;
      if (isTransfer(tx)) continue;
      if (tx.transaction_repayments && tx.transaction_repayments.length > 0) continue;
      if (!tx.date) continue;

      const [yStr, mStr, dStr] = tx.date.split('-');
      const year = parseInt(yStr);
      const month = parseInt(mStr) - 1;
      const day = parseInt(dStr);
      const amount = parseFloat(tx.amount);
      if (amount >= 0) continue; // only spending (negative amounts)

      const settledReimbursement = tx.transaction_splits?.reduce(
        (sum: number, split: { is_settled: boolean; amount: string }) =>
          split.is_settled ? sum + (parseFloat(split.amount) || 0) : sum,
        0
      ) || 0;
      const spending = Math.max(0, Math.abs(amount) - settledReimbursement);

      // MoM comparison
      if (year === currentYear && month === currentMonth && day <= currentDay) {
        currentMonthSpending += spending;
      }
      if (year === lastMonthYear && month === lastMonth && day <= comparisonDay) {
        lastMonthSpending += spending;
      }

      // Monthly totals for category shift
      const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
      monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + spending;

      // Current month category breakdown
      if (year === currentYear && month === currentMonth) {
        const catLabel = tx.system_categories?.label || 'Other';
        if (!currentMonthCategories[catLabel]) {
          currentMonthCategories[catLabel] = { label: catLabel, total: 0 };
        }
        currentMonthCategories[catLabel].total += spending;
      }
    }

    // ── Build data for generators ──

    // Monthly data for topCategoryShift
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const months = Object.entries(monthlySpending).map(([key, spending]) => ({
      spending,
      isCurrentMonth: key === currentMonthKey,
      isComplete: key !== currentMonthKey,
    }));

    const categories = Object.values(currentMonthCategories)
      .map((c) => ({ label: c.label, total_spent: c.total }))
      .sort((a, b) => b.total_spent - a.total_spent);

    // ── Run generators ──
    const insights: Insight[] = [];

    // Spending pace (free)
    const pace = spendingPace({ currentMonthSpending, lastMonthSpending });
    if (pace) insights.push(pace);

    // Top category shift (free)
    const catShift = topCategoryShift({ categories, months });
    if (catShift) insights.push(catShift);

    // Budget alert (pro)
    if (canAccess(tier, 'budgets')) {
      try {
        const budgets = await getBudgetProgress(supabaseAdmin, userId);
        const alert = budgetAlert(budgets);
        if (alert) insights.push(alert);
      } catch (e) {
        console.warn('[insights] budget fetch failed:', e);
      }
    }

    // Upcoming bills (pro)
    if (canAccess(tier, 'recurring')) {
      try {
        const { data: streams } = await supabaseAdmin
          .from('recurring_streams')
          .select('stream_type, predicted_next_date, average_amount, merchant_name')
          .eq('user_id', userId)
          .eq('is_active', true);
        const bills = upcomingBills(streams || []);
        if (bills) insights.push(bills);
      } catch (e) {
        console.warn('[insights] recurring fetch failed:', e);
      }
    }

    // Sort: priority ascending, then negative tone first
    const toneOrder = { negative: 0, neutral: 1, positive: 2 };
    insights.sort((a, b) => a.priority - b.priority || toneOrder[a.tone] - toneOrder[b.tone]);

    return Response.json({ insights });
  } catch (err) {
    console.error('[insights] unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
