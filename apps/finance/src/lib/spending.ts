import { startOfMonth, endOfMonth, subMonths, isValid } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables, TablesInsert } from '../types/database';

type AnySupabase = SupabaseClient<Database>;

type BudgetRow = Tables<'budgets'>;
type SystemCategoryRow = Tables<'system_categories'>;

interface BudgetWithRelations extends BudgetRow {
  category_groups: Pick<
    Tables<'category_groups'>,
    'id' | 'name' | 'icon_name' | 'icon_lib' | 'hex_color'
  > | null;
  system_categories: Pick<
    SystemCategoryRow,
    'id' | 'label' | 'group_id' | 'hex_color'
  > | null;
}

export interface BudgetProgress extends BudgetWithRelations {
  spent: number;
  remaining: number;
  percentage: number;
}

interface BudgetTransactionRow {
  amount: number;
  category_id: string | null;
  datetime?: string | null;
  date?: string | null;
}

/**
 * Calculates budget progress for the specified user and month.
 *
 * Returns the budgets with `spent`, `remaining`, and `percentage` fields added.
 */
export async function getBudgetProgress(
  supabase: AnySupabase,
  userId: string,
  monthDate: string | Date | null = null
): Promise<BudgetProgress[]> {
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

  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select(
      `
      *,
      category_groups (id, name, icon_name, icon_lib, hex_color),
      system_categories (id, label, group_id, hex_color)
    `
    )
    .eq('user_id', userId);

  if (budgetError) {
    console.error('Error fetching budgets:', budgetError);
    throw budgetError;
  }

  if (!budgets || budgets.length === 0) return [];

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

  const { data: allCategories, error: catError } = await supabase
    .from('system_categories')
    .select('id, group_id');

  if (catError) {
    console.error('Error fetching categories for mapping:', catError);
    throw catError;
  }

  const categoryGroupMap = new Map<string, string | null>();
  (allCategories ?? []).forEach((cat: Pick<SystemCategoryRow, 'id' | 'group_id'>) => {
    categoryGroupMap.set(cat.id, cat.group_id);
  });

  const txList = (transactions ?? []) as BudgetTransactionRow[];

  const budgetProgress: BudgetProgress[] = (budgets as BudgetWithRelations[]).map(
    (budget) => {
      const relevantTransactions = txList.filter((tx) => {
        if (budget.category_id) {
          return tx.category_id === budget.category_id;
        }
        if (budget.category_group_id) {
          const txGroupId = tx.category_id
            ? categoryGroupMap.get(tx.category_id)
            : undefined;
          return txGroupId === budget.category_group_id;
        }
        return false;
      });

      // Transactions are stored with the convention: negative = spending,
      // positive = income/refunds. Only count spending against the budget,
      // and flip the sign so `spent` is a positive dollar amount. This
      // matches how /api/transactions/spending-by-category sums things.
      const spent = relevantTransactions.reduce((sum, tx) => {
        const amt = Number(tx.amount) || 0;
        if (amt >= 0) return sum;
        return sum + Math.abs(amt);
      }, 0);

      const total = Number(budget.amount);
      const remaining = total - spent;
      const percentage = total > 0 ? (spent / total) * 100 : spent > 0 ? 100 : 0;

      return { ...budget, spent, remaining, percentage };
    }
  );

  return budgetProgress;
}

export interface MonthlyBurnPoint {
  day: number;
  spent: number;
  cumulative: number;
}

/**
 * Aggregates spending in budgeted categories by day for the current (or
 * specified) month. Returns a daily cumulative series the UI can plot as
 * a burn-down chart.
 *
 * Only days with spending are included — the client can fill gaps or
 * step-interpolate. The function does its own queries rather than reusing
 * getBudgetProgress so callers can invoke it independently.
 */
export async function getMonthlyBurn(
  supabase: AnySupabase,
  userId: string,
  monthDate: string | Date | null = null
): Promise<MonthlyBurnPoint[]> {
  if (!userId) throw new Error('UserId is required');
  const date = monthDate ? new Date(monthDate) : new Date();
  if (!isValid(date)) throw new Error('Invalid date provided');

  const start = startOfMonth(date).toISOString();
  const end = endOfMonth(date).toISOString();

  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select('category_id, category_group_id')
    .eq('user_id', userId);
  if (budgetError) throw budgetError;
  if (!budgets || budgets.length === 0) return [];

  type BudgetMembership = Pick<BudgetRow, 'category_id' | 'category_group_id'>;
  const budgetRows = budgets as BudgetMembership[];

  const budgetedCategoryIds = new Set(
    budgetRows.map((b) => b.category_id).filter((id): id is string => Boolean(id))
  );
  const budgetedGroupIds = new Set(
    budgetRows
      .map((b) => b.category_group_id)
      .filter((id): id is string => Boolean(id))
  );

  // If the user only budgets at the group level, we need a category→group
  // map to decide which transactions count.
  const categoryGroupMap = new Map<string, string | null>();
  if (budgetedGroupIds.size > 0) {
    const { data: allCategories, error: catError } = await supabase
      .from('system_categories')
      .select('id, group_id');
    if (catError) throw catError;
    (allCategories ?? []).forEach(
      (c: Pick<SystemCategoryRow, 'id' | 'group_id'>) => {
        categoryGroupMap.set(c.id, c.group_id);
      }
    );
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
  const perDay = new Map<number, number>();
  (transactions as BudgetTransactionRow[] | null)?.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (amt >= 0) return;

    const txCategoryId = tx.category_id;
    const matchesBudget =
      (txCategoryId !== null && budgetedCategoryIds.has(txCategoryId)) ||
      (txCategoryId !== null &&
        budgetedGroupIds.has(categoryGroupMap.get(txCategoryId) ?? ''));
    if (!matchesBudget) return;

    // Use the date column (YYYY-MM-DD) directly so we don't drift across
    // time zones.
    const day = Number((tx.date || '').slice(8, 10));
    if (!day) return;
    perDay.set(day, (perDay.get(day) || 0) + Math.abs(amt));
  });

  const sortedDays = Array.from(perDay.keys()).sort((a, b) => a - b);
  let running = 0;
  return sortedDays.map((day) => {
    const spent = perDay.get(day) ?? 0;
    running += spent;
    return { day, spent, cumulative: Number(running.toFixed(2)) };
  });
}

export interface BudgetHistoryEntry {
  id: string;
  label: string;
  color: string;
  amount: number;
  spent: number;
}

export interface BudgetHistoryMonth {
  month: string;
  year: number;
  monthNumber: number;
  isCurrent: boolean;
  budgets: BudgetHistoryEntry[];
}

/**
 * Returns per-budget spending for each of the last N months (including the
 * current, incomplete month). Used by the Budget Performance chart.
 *
 * Fetches budgets once and all relevant transactions in a single query,
 * then groups in JS to avoid N+1 round trips.
 */
export async function getBudgetHistory(
  supabase: AnySupabase,
  userId: string,
  months: number = 6
): Promise<BudgetHistoryMonth[]> {
  if (!userId) throw new Error('UserId is required');

  const { data: budgets, error: budgetError } = await supabase
    .from('budgets')
    .select(
      `
      *,
      category_groups (id, name, icon_name, icon_lib, hex_color),
      system_categories (id, label, group_id, hex_color)
    `
    )
    .eq('user_id', userId);
  if (budgetError) throw budgetError;
  if (!budgets || budgets.length === 0) return [];

  const budgetsTyped = budgets as BudgetWithRelations[];

  const budgetedGroupIds = new Set(
    budgetsTyped
      .map((b) => b.category_group_id)
      .filter((id): id is string => Boolean(id))
  );
  const categoryGroupMap = new Map<string, string | null>();
  if (budgetedGroupIds.size > 0) {
    const { data: allCategories, error: catError } = await supabase
      .from('system_categories')
      .select('id, group_id');
    if (catError) throw catError;
    (allCategories ?? []).forEach(
      (c: Pick<SystemCategoryRow, 'id' | 'group_id'>) => {
        categoryGroupMap.set(c.id, c.group_id);
      }
    );
  }

  // Determine date range: start of (months-1) months ago through end of
  // current month. months=6 gives 5 complete past months + current.
  const now = new Date();
  const rangeStart = startOfMonth(subMonths(now, months - 1)).toISOString();
  const rangeEnd = endOfMonth(now).toISOString();

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, category_id, date, accounts!inner(user_id)')
    .eq('accounts.user_id', userId)
    .gte('datetime', rangeStart)
    .lte('datetime', rangeEnd);
  if (txError) throw txError;

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthNames = [
    '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  // Internal bucket type carries the category fields needed for transaction
  // routing; they're stripped before the function returns.
  interface InternalBudgetEntry extends BudgetHistoryEntry {
    category_id: string | null;
    category_group_id: string | null;
  }
  interface InternalBucket extends Omit<BudgetHistoryMonth, 'budgets'> {
    budgets: InternalBudgetEntry[];
  }

  const monthBuckets: InternalBucket[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    monthBuckets.push({
      month: monthNames[m],
      year: y,
      monthNumber: m,
      isCurrent: m === currentMonth && y === currentYear,
      budgets: budgetsTyped.map((b) => {
        const isGroup = !!b.category_groups;
        return {
          id: b.id,
          label: isGroup
            ? b.category_groups?.name ?? 'Unknown'
            : b.system_categories?.label ?? 'Unknown',
          color: isGroup
            ? b.category_groups?.hex_color ?? '#71717a'
            : b.system_categories?.hex_color ?? '#71717a',
          amount: Number(b.amount || 0),
          spent: 0,
          category_id: b.category_id,
          category_group_id: b.category_group_id,
        };
      }),
    });
  }

  (transactions as BudgetTransactionRow[] | null)?.forEach((tx) => {
    const amt = Number(tx.amount) || 0;
    if (amt >= 0) return;

    const txDate = tx.date || '';
    const txYear = Number(txDate.slice(0, 4));
    const txMonth = Number(txDate.slice(5, 7));

    const bucket = monthBuckets.find(
      (b) => b.monthNumber === txMonth && b.year === txYear
    );
    if (!bucket) return;

    bucket.budgets.forEach((bb) => {
      if (bb.category_id) {
        if (tx.category_id === bb.category_id) {
          bb.spent += Math.abs(amt);
        }
      } else if (bb.category_group_id) {
        const txGroupId = tx.category_id
          ? categoryGroupMap.get(tx.category_id)
          : undefined;
        if (txGroupId === bb.category_group_id) {
          bb.spent += Math.abs(amt);
        }
      }
    });
  });

  return monthBuckets.map((bucket) => ({
    ...bucket,
    budgets: bucket.budgets.map(
      ({ category_id: _cid, category_group_id: _cgid, ...rest }) => ({
        ...rest,
        spent: Number(rest.spent.toFixed(2)),
      })
    ),
  }));
}

/**
 * Creates or updates a budget.
 */
export async function upsertBudget(
  supabase: AnySupabase,
  budgetData: TablesInsert<'budgets'>
): Promise<BudgetRow> {
  if (!budgetData.user_id) throw new Error('user_id is required in budgetData');

  const { data, error } = await supabase
    .from('budgets')
    .upsert(budgetData)
    .select()
    .single();

  if (error) {
    console.error('Error upserting budget:', error);
    throw error;
  }

  return data as BudgetRow;
}

/**
 * Deletes a budget.
 */
export async function deleteBudget(
  supabase: AnySupabase,
  budgetId: string,
  userId: string
): Promise<true> {
  if (!userId) throw new Error('userId is required for deletion safety');

  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting budget:', error);
    throw error;
  }

  return true;
}
