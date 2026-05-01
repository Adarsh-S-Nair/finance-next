/**
 * Agent tool definitions + executors.
 *
 * Each tool has two halves:
 *   - `definition`: the JSON schema shape we hand to Anthropic so the
 *     model can decide when/how to call it.
 *   - `execute(userId, input)`: server-side runner that fetches data
 *     from Supabase, scoped to the calling user. Always returns a
 *     plain object (never throws to Anthropic — errors come back as
 *     `{ error: string }` so the model can see them and recover).
 *
 * Read-only for now. Write tools (modify budgets, recategorize
 * transactions) land in a follow-up commit with confirmation flows.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
import { supabaseAdmin } from '../supabase/admin';
import { getBudgetProgress } from '../spending';

type ToolDefinition = Anthropic.Messages.Tool;

// ──────────────────────────────────────────────────────────────────────────
// Tool definitions (handed to Anthropic verbatim)
// ──────────────────────────────────────────────────────────────────────────

export const TOOLS: ToolDefinition[] = [
  {
    name: 'get_budgets',
    description:
      "List the user's budgets for a given month, with how much they've " +
      "spent in each. Use this when the user asks about their budgets, " +
      "whether they're over/under, or how a category is doing this month. " +
      "Defaults to the current month if `month` is not provided.",
    input_schema: {
      type: 'object',
      properties: {
        month: {
          type: 'string',
          description:
            'Month to query in YYYY-MM-DD format (any date in the month works). ' +
            'Omit for the current month.',
        },
      },
    },
  },
  {
    name: 'get_recent_transactions',
    description:
      "Pull recent transactions, most recent first. Use this when the user " +
      "asks about specific spending events, recent activity, transactions " +
      "from a particular merchant, or wants to see what they've been " +
      "spending money on lately.",
    input_schema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Max transactions to return (1-50). Defaults to 20.',
          minimum: 1,
          maximum: 50,
        },
        days: {
          type: 'integer',
          description:
            'How many days back to search. Defaults to 30. Use 7 for "this week", 90 for a quarter.',
          minimum: 1,
          maximum: 365,
        },
        merchant_query: {
          type: 'string',
          description:
            'Optional case-insensitive substring match against the merchant name or description. ' +
            'E.g. "starbucks", "amazon".',
        },
      },
    },
  },
  {
    name: 'get_spending_by_category',
    description:
      "Get a breakdown of spending grouped by category for a given period. " +
      "Use this when the user asks 'where is my money going', wants to see " +
      "their top spending categories, or asks about spending trends.",
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['this_month', 'last_30_days', 'last_90_days'],
          description:
            'Time window. Defaults to this_month if omitted.',
        },
      },
    },
  },
  {
    name: 'get_account_balances',
    description:
      "List the user's connected accounts with current balances. Use this " +
      "when the user asks about their account balances, net worth, how much " +
      "they have in checking/savings, or which accounts are connected.",
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────
// Executors
// ──────────────────────────────────────────────────────────────────────────

type ToolName =
  | 'get_budgets'
  | 'get_recent_transactions'
  | 'get_spending_by_category'
  | 'get_account_balances';

interface BudgetsInput {
  month?: string;
}
interface RecentTransactionsInput {
  limit?: number;
  days?: number;
  merchant_query?: string;
}
interface SpendingByCategoryInput {
  period?: 'this_month' | 'last_30_days' | 'last_90_days';
}

export async function executeTool(
  name: string,
  input: unknown,
  userId: string,
): Promise<unknown> {
  try {
    switch (name as ToolName) {
      case 'get_budgets':
        return await getBudgets(userId, (input as BudgetsInput) ?? {});
      case 'get_recent_transactions':
        return await getRecentTransactions(
          userId,
          (input as RecentTransactionsInput) ?? {},
        );
      case 'get_spending_by_category':
        return await getSpendingByCategory(
          userId,
          (input as SpendingByCategoryInput) ?? {},
        );
      case 'get_account_balances':
        return await getAccountBalances(userId);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`[agent:tool:${name}] failed`, err);
    return {
      error: err instanceof Error ? err.message : 'Tool execution failed',
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Tool implementations
// ──────────────────────────────────────────────────────────────────────────

async function getBudgets(userId: string, input: BudgetsInput) {
  const monthDate = input.month ? new Date(input.month) : new Date();
  const progress = await getBudgetProgress(supabaseAdmin, userId, monthDate);

  const budgets = progress.map((b) => {
    // Normalize: getBudgetProgress returns BudgetProgress (extends BudgetRow
    // with relations + computed totals). The shape varies a bit across
    // category vs group budgets; pick out the bits the model + UI need.
    const rec = b as unknown as Record<string, unknown>;
    return {
      id: rec.id,
      label:
        (rec.category_groups as { name?: string } | undefined)?.name ??
        (rec.system_categories as { label?: string } | undefined)?.label ??
        'Uncategorized',
      hex_color:
        (rec.category_groups as { hex_color?: string } | undefined)?.hex_color ??
        (rec.system_categories as { hex_color?: string } | undefined)?.hex_color ??
        '#71717a',
      icon:
        (rec.category_groups as { icon_name?: string } | undefined)?.icon_name ??
        null,
      budget_amount: Number(rec.amount ?? 0),
      spent: Number(rec.totalSpent ?? 0),
      remaining: Number(rec.amount ?? 0) - Number(rec.totalSpent ?? 0),
      percent_used:
        Number(rec.amount ?? 0) > 0
          ? Math.round((Number(rec.totalSpent ?? 0) / Number(rec.amount ?? 0)) * 100)
          : 0,
    };
  });

  const totalBudgeted = budgets.reduce((acc, b) => acc + b.budget_amount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);

  return {
    month: format(startOfMonth(monthDate), 'yyyy-MM'),
    budgets,
    total_budgeted: totalBudgeted,
    total_spent: totalSpent,
    over_budget_count: budgets.filter((b) => b.spent > b.budget_amount).length,
  };
}

async function getRecentTransactions(userId: string, input: RecentTransactionsInput) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const days = Math.min(Math.max(input.days ?? 30, 1), 365);
  const since = format(subDays(new Date(), days), 'yyyy-MM-dd');

  let query = supabaseAdmin
    .from('transactions')
    .select(
      `
        id,
        amount,
        description,
        merchant_name,
        date,
        category_id,
        icon_url,
        accounts!inner(user_id, name),
        system_categories(label, hex_color)
      `,
    )
    .eq('accounts.user_id', userId)
    .gte('date', since)
    .order('date', { ascending: false })
    .limit(limit);

  if (input.merchant_query && input.merchant_query.trim().length > 0) {
    const q = input.merchant_query.trim();
    query = query.or(
      `description.ilike.%${q}%,merchant_name.ilike.%${q}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  const transactions = (data ?? []).map((t) => {
    const cat = t.system_categories as
      | { label?: string; hex_color?: string }
      | null;
    const acc = t.accounts as { name?: string } | null;
    return {
      id: t.id,
      date: t.date,
      description: t.description,
      merchant_name: t.merchant_name,
      amount: Number(t.amount ?? 0),
      category: cat?.label ?? 'Uncategorized',
      category_color: cat?.hex_color ?? '#71717a',
      account_name: acc?.name ?? 'Account',
      icon_url: t.icon_url ?? null,
    };
  });

  return {
    transactions,
    count: transactions.length,
    days_searched: days,
    merchant_query: input.merchant_query ?? null,
  };
}

async function getSpendingByCategory(userId: string, input: SpendingByCategoryInput) {
  const period = input.period ?? 'this_month';
  const today = new Date();
  let start: Date;
  let end: Date;
  switch (period) {
    case 'last_30_days':
      end = today;
      start = subDays(today, 30);
      break;
    case 'last_90_days':
      end = today;
      start = subDays(today, 90);
      break;
    case 'this_month':
    default:
      start = startOfMonth(today);
      end = endOfMonth(today);
      break;
  }

  // Pull spending transactions in window. Negative amounts (refunds) are
  // ignored to avoid muddling the picture; this matches the dashboard.
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select(
      `
        amount,
        category_id,
        accounts!inner(user_id),
        system_categories(label, hex_color)
      `,
    )
    .eq('accounts.user_id', userId)
    .gte('date', format(start, 'yyyy-MM-dd'))
    .lte('date', format(end, 'yyyy-MM-dd'));

  if (error) throw error;

  const buckets = new Map<string, { label: string; total: number; color: string }>();
  let totalSpending = 0;
  for (const tx of data ?? []) {
    const amount = Number(tx.amount ?? 0);
    if (amount <= 0) continue;
    const cat = tx.system_categories as
      | { label?: string; hex_color?: string }
      | null;
    const label = cat?.label ?? 'Uncategorized';
    const color = cat?.hex_color ?? '#71717a';
    const existing = buckets.get(label) ?? { label, total: 0, color };
    existing.total += amount;
    buckets.set(label, existing);
    totalSpending += amount;
  }

  const categories = Array.from(buckets.values())
    .sort((a, b) => b.total - a.total)
    .map((c) => ({
      label: c.label,
      total: Math.round(c.total * 100) / 100,
      color: c.color,
      percent: totalSpending > 0 ? Math.round((c.total / totalSpending) * 100) : 0,
    }));

  return {
    period,
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
    categories,
    total_spending: Math.round(totalSpending * 100) / 100,
  };
}

async function getAccountBalances(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select(
      'id, name, type, subtype, plaid_balance_current, plaid_balance_available, mask, institutions(name)',
    )
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) throw error;

  // Categorize so the model can reason about cash vs credit vs investments.
  const accounts = (data ?? []).map((a) => {
    const t = `${a.type ?? ''} ${a.subtype ?? ''}`.toLowerCase();
    let category: 'cash' | 'credit' | 'loan' | 'investment' | 'other' = 'other';
    if (/credit/.test(t)) category = 'credit';
    else if (/loan|mortgage|line of credit/.test(t)) category = 'loan';
    else if (/investment|brokerage|401k|ira|retirement/.test(t)) category = 'investment';
    else if (/checking|savings|cash|depository/.test(t)) category = 'cash';

    const inst = a.institutions as { name?: string } | null;

    return {
      id: a.id,
      name: a.name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      category,
      institution: inst?.name ?? null,
      current_balance: Number(a.plaid_balance_current ?? 0),
      available_balance:
        a.plaid_balance_available !== null
          ? Number(a.plaid_balance_available)
          : null,
    };
  });

  // Roll-up totals so the model can answer "what's my net worth?" without
  // a follow-up tool call.
  const totals = accounts.reduce(
    (acc, a) => {
      if (a.category === 'cash' || a.category === 'investment') {
        acc.assets += a.current_balance;
      } else if (a.category === 'credit' || a.category === 'loan') {
        acc.liabilities += Math.abs(a.current_balance);
      }
      return acc;
    },
    { assets: 0, liabilities: 0 },
  );

  return {
    accounts,
    totals: {
      total_assets: Math.round(totals.assets * 100) / 100,
      total_liabilities: Math.round(totals.liabilities * 100) / 100,
      net_worth: Math.round((totals.assets - totals.liabilities) * 100) / 100,
    },
  };
}
