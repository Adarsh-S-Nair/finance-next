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
import { format, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
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
      "Search the user's transactions with a flexible set of filters that mirror the " +
      "/transactions page in the app. Filters are AND-ed together. Reach for this whenever the " +
      "user asks about transactions, spending events, or a specific slice of their activity " +
      "— pick whichever filters match the question.\n\n" +
      "Examples (assuming today is 2026-05-01):\n" +
      "- \"what did I spend on food and drink last month?\"  →  { month: \"2026-04-15\", category_query: \"food and drink\", type: \"expense\" }\n" +
      "- \"show me purchases over $100 this week\"  →  { days: 7, min_amount: 100, type: \"expense\" }\n" +
      "- \"chase card transactions in March\"  →  { account_query: \"chase\", start_date: \"2026-03-01\", end_date: \"2026-03-31\" }\n" +
      "- \"any pending transactions?\"  →  { status: \"pending\" }\n" +
      "- \"transactions between $20 and $50 last month\"  →  { month: \"2026-04-15\", min_amount: 20, max_amount: 50 }\n" +
      "- \"my last 5 starbucks visits\"  →  { merchant_query: \"starbucks\", limit: 5, days: 365 }\n" +
      "- \"income i received in April\"  →  { month: \"2026-04-15\", type: \"income\" }",
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
            'Rolling window: how many days back to search from today. Defaults to 30. ' +
            'Ignored if `month` or `start_date`/`end_date` is provided.',
          minimum: 1,
          maximum: 365,
        },
        month: {
          type: 'string',
          description:
            'Calendar month to query in YYYY-MM-DD format (any date in the month works). ' +
            'Use for questions about a specific month (e.g. "last month", "in April"). ' +
            'Ignored if `start_date`/`end_date` is provided.',
        },
        start_date: {
          type: 'string',
          description:
            'Inclusive start of an arbitrary date window (YYYY-MM-DD). Use for custom ranges ' +
            'that don\'t line up with a single calendar month. When set, overrides `month` and `days`.',
        },
        end_date: {
          type: 'string',
          description:
            'Inclusive end of an arbitrary date window (YYYY-MM-DD). Pair with `start_date`.',
        },
        type: {
          type: 'string',
          enum: ['income', 'expense'],
          description:
            '`expense` filters to outflows (negative amounts), `income` filters to inflows ' +
            '(positive amounts). Omit to include both. When the user asks "what did I spend" ' +
            'pass `expense`; when they ask about income/refunds/transfers in pass `income`.',
        },
        status: {
          type: 'string',
          enum: ['pending', 'completed', 'attention'],
          description:
            '`pending` = not yet posted; `completed` = posted; `attention` = transactions the ' +
            'user should review (unmatched transfers, unknown account). Omit to include any.',
        },
        min_amount: {
          type: 'number',
          description:
            'Minimum absolute dollar amount, sign-agnostic. E.g. 100 matches both +$100 income ' +
            'and -$100 spending. Use for "over $X" questions.',
          minimum: 0,
        },
        max_amount: {
          type: 'number',
          description:
            'Maximum absolute dollar amount, sign-agnostic. Use for "under $X" or with min_amount ' +
            'for a range.',
          minimum: 0,
        },
        merchant_query: {
          type: 'string',
          description:
            'Case-insensitive substring against the merchant name or description. E.g. "starbucks", ' +
            '"amazon". Use when the user names a specific business.',
        },
        category_query: {
          type: 'string',
          description:
            'Case-insensitive substring against the category label or category group name. ' +
            'E.g. "food and drink", "groceries", "transportation". Use when the user asks about ' +
            'a category of spending rather than a specific merchant.',
        },
        account_query: {
          type: 'string',
          description:
            'Case-insensitive substring against the account name or institution name. E.g. "chase", ' +
            '"checking", "amex". Use when the user asks about a specific account or institution. ' +
            'Call get_account_balances first if you need the exact account names.',
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
          enum: ['this_month', 'last_month', 'last_30_days', 'last_90_days'],
          description:
            'Time window. `this_month` and `last_month` use calendar-month boundaries; ' +
            '`last_30_days` and `last_90_days` are rolling. Defaults to this_month.',
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
  {
    name: 'list_categories',
    description:
      "List every category the user can assign a transaction to, grouped by " +
      "category group. Call this before propose_recategorization so you have " +
      "the valid category_id values to suggest. The response is small (~50 " +
      "categories) and not rendered to the user — it's metadata for you. " +
      "If the user just asks 'what categories exist?' you can summarise the " +
      "groups in prose without rendering anything.",
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'propose_recategorization',
    description:
      "Suggest a category change for a single transaction. Renders an inline " +
      "confirmation widget with accept/decline buttons — this tool does NOT " +
      "write to the database; the user has to click accept for the change to " +
      "happen. Use this when you have a concrete category suggestion that's " +
      "better than the transaction's current category. If you think the " +
      "current category is already best, do NOT call this tool — just say so " +
      "in prose. Always call list_categories first so you know the valid " +
      "category_id values.\n\n" +
      "Example: user asks 'what could Claude.ai be recategorized to?' and " +
      "you find it's currently 'Other General Service'. Call list_categories, " +
      "find the 'Software' category id, then propose_recategorization with " +
      "{ transaction_id, new_category_id, reasoning: \"It's a SaaS subscription\" }.",
    input_schema: {
      type: 'object',
      properties: {
        transaction_id: {
          type: 'string',
          description: 'UUID of the transaction to recategorize. From get_recent_transactions.',
        },
        new_category_id: {
          type: 'string',
          description: 'UUID of the suggested category. From list_categories.',
        },
        reasoning: {
          type: 'string',
          description:
            'One short sentence explaining why this category is a better fit. ' +
            'Shown in the widget so the user understands the suggestion.',
        },
      },
      required: ['transaction_id', 'new_category_id'],
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
  | 'get_account_balances'
  | 'list_categories'
  | 'propose_recategorization';

interface BudgetsInput {
  month?: string;
}
interface RecentTransactionsInput {
  limit?: number;
  days?: number;
  month?: string;
  start_date?: string;
  end_date?: string;
  type?: 'income' | 'expense';
  status?: 'pending' | 'completed' | 'attention';
  min_amount?: number;
  max_amount?: number;
  merchant_query?: string;
  category_query?: string;
  account_query?: string;
}
interface SpendingByCategoryInput {
  period?: 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days';
}
interface ProposeRecategorizationInput {
  transaction_id?: string;
  new_category_id?: string;
  reasoning?: string;
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
      case 'list_categories':
        return await listCategories();
      case 'propose_recategorization':
        return await proposeRecategorization(
          userId,
          (input as ProposeRecategorizationInput) ?? {},
        );
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

  // getBudgetProgress joins category_groups directly (for group-budgets)
  // and system_categories directly (for category-budgets) — but a
  // category-budget's category_groups relation is null since the
  // relation key is on the budget table. To render category icons for
  // category-budgets, we need to look up their category's group_id and
  // fetch the group separately. One round-trip total.
  const categoryGroupIds = new Set<string>();
  for (const b of progress) {
    const rec = b as unknown as Record<string, unknown>;
    const cat = rec.system_categories as
      | { group_id?: string | null }
      | null
      | undefined;
    if (cat?.group_id) categoryGroupIds.add(cat.group_id);
  }
  const groupIconMap = new Map<
    string,
    { icon_lib: string | null; icon_name: string | null; hex_color: string | null }
  >();
  if (categoryGroupIds.size > 0) {
    const { data: groups } = await supabaseAdmin
      .from('category_groups')
      .select('id, icon_lib, icon_name, hex_color')
      .in('id', Array.from(categoryGroupIds));
    for (const g of groups ?? []) {
      groupIconMap.set(g.id, {
        icon_lib: g.icon_lib ?? null,
        icon_name: g.icon_name ?? null,
        hex_color: g.hex_color ?? null,
      });
    }
  }

  const budgets = progress.map((b) => {
    const rec = b as unknown as Record<string, unknown>;
    const directGroup = rec.category_groups as
      | { name?: string; icon_name?: string; icon_lib?: string; hex_color?: string }
      | null
      | undefined;
    const cat = rec.system_categories as
      | { label?: string; hex_color?: string; group_id?: string | null }
      | null
      | undefined;
    // Group-budget: directGroup is populated.
    // Category-budget: directGroup is null, look up via category's group_id.
    const fallbackGroup =
      !directGroup && cat?.group_id ? groupIconMap.get(cat.group_id) ?? null : null;

    // getBudgetProgress returns the BudgetProgress shape, which extends
    // the budget row with `spent`, `remaining`, and `percentage`. Read
    // those fields, not the misnamed `totalSpent` I had before — that
    // was always undefined, which is why the widget kept reporting $0
    // spent regardless of how much the user actually spent.
    const spent = Number(rec.spent ?? 0);
    const amount = Number(rec.amount ?? 0);
    return {
      id: rec.id,
      label: directGroup?.name ?? cat?.label ?? 'Uncategorized',
      hex_color:
        directGroup?.hex_color ??
        cat?.hex_color ??
        fallbackGroup?.hex_color ??
        '#71717a',
      icon_lib: directGroup?.icon_lib ?? fallbackGroup?.icon_lib ?? null,
      icon_name: directGroup?.icon_name ?? fallbackGroup?.icon_name ?? null,
      budget_amount: amount,
      spent,
      remaining: amount - spent,
      percent_used: amount > 0 ? Math.round((spent / amount) * 100) : 0,
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

  const categoryQuery = input.category_query?.trim() ?? '';
  const merchantQuery = input.merchant_query?.trim() ?? '';
  const accountQuery = input.account_query?.trim() ?? '';

  // ── Date window resolution ──────────────────────────────────────────
  // Precedence: explicit start_date/end_date > month > rolling days.
  // This mirrors the transactions page UI where a custom range overrides
  // any preset.
  let startDate: string;
  let endDate: string | null;
  let resolvedMonth: string | null = null;
  let resolvedRange: { start: string; end: string | null } | null = null;

  if (input.start_date || input.end_date) {
    const sd = input.start_date ? new Date(input.start_date) : null;
    const ed = input.end_date ? new Date(input.end_date) : null;
    if (sd && isNaN(sd.getTime())) return { error: `Invalid start_date: ${input.start_date}` };
    if (ed && isNaN(ed.getTime())) return { error: `Invalid end_date: ${input.end_date}` };
    // Without an explicit start_date, fall back to the user's earliest
    // possible relevant window — pinned to the rolling default — to avoid
    // accidentally scanning the whole table.
    startDate = sd
      ? format(sd, 'yyyy-MM-dd')
      : format(subDays(new Date(), days), 'yyyy-MM-dd');
    endDate = ed ? format(ed, 'yyyy-MM-dd') : null;
    resolvedRange = { start: startDate, end: endDate };
  } else if (input.month && input.month.trim().length > 0) {
    const monthDate = new Date(input.month);
    if (isNaN(monthDate.getTime())) {
      return { error: `Invalid month: ${input.month}` };
    }
    startDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    endDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');
    resolvedMonth = format(startOfMonth(monthDate), 'yyyy-MM');
  } else {
    startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    endDate = null;
  }

  // ── Status="attention" prep ─────────────────────────────────────────
  // Mirrors the API: surface unmatched transfers + transactions on
  // accounts with a null name. We need the latter ID list up front so
  // the OR clause can reference it.
  let attentionAccountIds: string[] = [];
  if (input.status === 'attention') {
    const { data: unknownAccounts } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('user_id', userId)
      .is('name', null);
    attentionAccountIds = (unknownAccounts ?? []).map((a) => a.id);
  }

  // We post-filter (in JS) for category and account substring matches
  // because postgrest's `.or()` doesn't compose across embedded relations,
  // and we don't want to round-trip name → id resolution. When either is
  // active, skip the DB-side `limit` so the filter has the full window
  // to work with before we slice.
  const overFetch = categoryQuery.length > 0 || accountQuery.length > 0;

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
        pending,
        is_unmatched_transfer,
        accounts!inner(user_id, name, mask, institutions(name)),
        system_categories(
          label,
          hex_color,
          category_groups(name, icon_lib, icon_name, hex_color)
        )
      `,
    )
    .eq('accounts.user_id', userId)
    .gte('date', startDate)
    .order('date', { ascending: false });

  if (endDate) {
    query = query.lte('date', endDate);
  }

  if (!overFetch) {
    query = query.limit(limit);
  }

  if (merchantQuery.length > 0) {
    query = query.or(
      `description.ilike.%${merchantQuery}%,merchant_name.ilike.%${merchantQuery}%`,
    );
  }

  // Type → sign filter. Plaid convention used throughout this codebase:
  // positive = income/inflow, negative = expense/outflow.
  if (input.type === 'income') {
    query = query.gt('amount', 0);
  } else if (input.type === 'expense') {
    query = query.lt('amount', 0);
  }

  if (input.status === 'pending') {
    query = query.eq('pending', true);
  } else if (input.status === 'completed') {
    query = query.not('pending', 'is', true);
  } else if (input.status === 'attention') {
    if (attentionAccountIds.length > 0) {
      query = query.or(
        `is_unmatched_transfer.eq.true,account_id.in.(${attentionAccountIds.join(',')})`,
      );
    } else {
      query = query.eq('is_unmatched_transfer', true);
    }
  }

  // Amount range — sign-agnostic absolute value. Matches the UI's mental
  // model where "$50 to $200" means |amount| between 50 and 200.
  if (typeof input.min_amount === 'number' && input.min_amount > 0) {
    const min = input.min_amount;
    query = query.or(`amount.gte.${min},amount.lte.-${min}`);
  }
  if (typeof input.max_amount === 'number' && input.max_amount > 0) {
    const max = input.max_amount;
    query = query.lte('amount', max).gte('amount', -max);
  }

  const { data, error } = await query;
  if (error) throw error;

  const catNeedle = categoryQuery.toLowerCase();
  const accNeedle = accountQuery.toLowerCase();

  const transactions = (data ?? [])
    .map((t) => {
      const cat = t.system_categories as
        | {
            label?: string;
            hex_color?: string;
            category_groups?: {
              name?: string | null;
              icon_lib?: string | null;
              icon_name?: string | null;
              hex_color?: string | null;
            } | null;
          }
        | null;
      const group = cat?.category_groups ?? null;
      const acc = t.accounts as
        | {
            name?: string | null;
            mask?: string | null;
            institutions?: { name?: string | null } | null;
          }
        | null;
      return {
        id: t.id,
        date: t.date,
        description: t.description,
        merchant_name: t.merchant_name,
        amount: Number(t.amount ?? 0),
        pending: t.pending ?? false,
        category: cat?.label ?? 'Uncategorized',
        category_group: group?.name ?? null,
        // Prefer the group's color (matches the chip on the transactions
        // page); fall back to the category-level color, then a neutral.
        category_color: group?.hex_color ?? cat?.hex_color ?? '#71717a',
        category_icon_lib: group?.icon_lib ?? null,
        category_icon_name: group?.icon_name ?? null,
        account_name: acc?.name ?? 'Account',
        account_mask: acc?.mask ?? null,
        institution: acc?.institutions?.name ?? null,
        icon_url: t.icon_url ?? null,
      };
    })
    .filter((t) => {
      if (catNeedle.length > 0) {
        const cat = t.category?.toLowerCase() ?? '';
        const grp = t.category_group?.toLowerCase() ?? '';
        if (!cat.includes(catNeedle) && !grp.includes(catNeedle)) return false;
      }
      if (accNeedle.length > 0) {
        const name = t.account_name?.toLowerCase() ?? '';
        const inst = t.institution?.toLowerCase() ?? '';
        if (!name.includes(accNeedle) && !inst.includes(accNeedle)) return false;
      }
      return true;
    })
    .slice(0, limit);

  return {
    transactions,
    count: transactions.length,
    // Echo the resolved filters back so the model can sanity-check what
    // it actually queried — same idea as the month label on the budget
    // widget. Helps the model self-correct on follow-ups.
    month: resolvedMonth,
    range: resolvedRange,
    days_searched: resolvedMonth || resolvedRange ? null : days,
    type: input.type ?? null,
    status: input.status ?? null,
    min_amount: input.min_amount ?? null,
    max_amount: input.max_amount ?? null,
    merchant_query: merchantQuery || null,
    category_query: categoryQuery || null,
    account_query: accountQuery || null,
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
    case 'last_month': {
      const prev = subMonths(today, 1);
      start = startOfMonth(prev);
      end = endOfMonth(prev);
      break;
    }
    case 'this_month':
    default:
      start = startOfMonth(today);
      end = endOfMonth(today);
      break;
  }

  // Pull transactions in window. In this app's sign convention (Plaid's
  // standard), NEGATIVE amounts are spending and POSITIVE amounts are
  // income / refunds / transfers in. We want the spending picture only —
  // the previous version had this inverted (`if amount <= 0 continue`),
  // which silently produced an *income* breakdown labelled as spending,
  // so the widget would show Salary / Account Transfer / Tax Refund as
  // the user's "top spending categories". This matches the convention
  // already in getBudgetProgress: skip non-negative, sum |amount|.
  const { data, error } = await supabaseAdmin
    .from('transactions')
    .select(
      `
        amount,
        category_id,
        accounts!inner(user_id),
        system_categories(label, hex_color, category_groups(name, hex_color))
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
    if (amount >= 0) continue; // skip income/refunds/transfers in
    const spend = Math.abs(amount);
    const cat = tx.system_categories as
      | {
          label?: string;
          hex_color?: string;
          category_groups?: { name?: string; hex_color?: string } | null;
        }
      | null;
    // Prefer the category group label so spending bucket matches the
    // user's mental model of how the app organises categories ("Food and
    // Drink" rather than the leaf "Coffee Shops" / "Fast Food").
    const group = cat?.category_groups ?? null;
    const label = group?.name ?? cat?.label ?? 'Uncategorized';
    const color = group?.hex_color ?? cat?.hex_color ?? '#71717a';
    const existing = buckets.get(label) ?? { label, total: 0, color };
    existing.total += spend;
    buckets.set(label, existing);
    totalSpending += spend;
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
      'id, name, type, subtype, plaid_balance_current, plaid_balance_available, mask, institutions(name, logo)',
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

    const inst = a.institutions as { name?: string; logo?: string } | null;

    return {
      id: a.id,
      name: a.name,
      mask: a.mask,
      type: a.type,
      subtype: a.subtype,
      category,
      institution: inst?.name ?? null,
      institution_logo: inst?.logo ?? null,
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

// ──────────────────────────────────────────────────────────────────────────
// Categorization tools
// ──────────────────────────────────────────────────────────────────────────

async function listCategories() {
  // Categories are global (system_categories), so no userId scope needed.
  // The user picks from the same set everyone else does.
  const { data, error } = await supabaseAdmin
    .from('system_categories')
    .select(
      `id, label, hex_color, group_id,
       category_groups(id, name, icon_lib, icon_name, hex_color)`,
    )
    .order('label');

  if (error) throw error;

  // Group by category_group so the response shape matches how the user
  // sees categories in the app (group → leaf categories).
  type GroupBucket = {
    id: string;
    name: string;
    icon_lib: string | null;
    icon_name: string | null;
    hex_color: string | null;
    categories: { id: string; label: string; hex_color: string }[];
  };
  const buckets = new Map<string, GroupBucket>();

  for (const cat of data ?? []) {
    const group = cat.category_groups as
      | {
          id?: string;
          name?: string;
          icon_lib?: string | null;
          icon_name?: string | null;
          hex_color?: string | null;
        }
      | null;
    if (!group?.id) continue;
    const existing = buckets.get(group.id);
    if (!existing) {
      buckets.set(group.id, {
        id: group.id,
        name: group.name ?? 'Uncategorized',
        icon_lib: group.icon_lib ?? null,
        icon_name: group.icon_name ?? null,
        hex_color: group.hex_color ?? null,
        categories: [],
      });
    }
    buckets.get(group.id)!.categories.push({
      id: cat.id,
      label: cat.label,
      hex_color: cat.hex_color,
    });
  }

  return {
    groups: Array.from(buckets.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
  };
}

async function proposeRecategorization(
  userId: string,
  input: ProposeRecategorizationInput,
) {
  if (!input.transaction_id) {
    return { error: 'transaction_id is required' };
  }
  if (!input.new_category_id) {
    return { error: 'new_category_id is required' };
  }

  // Fetch the transaction with current category. The accounts!inner +
  // accounts.user_id filter is the auth check — admin client bypasses
  // RLS, so we have to scope by user_id ourselves.
  const { data: tx, error: txError } = await supabaseAdmin
    .from('transactions')
    .select(
      `
        id, amount, description, merchant_name, date, icon_url, category_id,
        accounts!inner(user_id, name),
        system_categories(
          id, label, hex_color,
          category_groups(name, icon_lib, icon_name, hex_color)
        )
      `,
    )
    .eq('id', input.transaction_id)
    .eq('accounts.user_id', userId)
    .maybeSingle();

  if (txError) throw txError;
  if (!tx) {
    return {
      error: `Transaction not found, or doesn't belong to this user: ${input.transaction_id}`,
    };
  }

  // No-op detection — if the suggested category equals the current one,
  // the model has nothing useful to propose. Surface that as an error so
  // the model can self-correct rather than rendering a confusing "from
  // X to X" widget.
  if (tx.category_id === input.new_category_id) {
    return {
      error:
        'The transaction is already in that category. If the current category is correct, just say so in your response without calling this tool.',
    };
  }

  const { data: newCat, error: catError } = await supabaseAdmin
    .from('system_categories')
    .select(
      `id, label, hex_color,
       category_groups(name, icon_lib, icon_name, hex_color)`,
    )
    .eq('id', input.new_category_id)
    .maybeSingle();

  if (catError) throw catError;
  if (!newCat) {
    return { error: `Suggested category not found: ${input.new_category_id}` };
  }

  type CatGroup = {
    name?: string | null;
    icon_lib?: string | null;
    icon_name?: string | null;
    hex_color?: string | null;
  };
  const currentSysCat = tx.system_categories as
    | {
        id?: string;
        label?: string;
        hex_color?: string;
        category_groups?: CatGroup | null;
      }
    | null;
  const currentGroup = currentSysCat?.category_groups ?? null;
  const newGroup = newCat.category_groups as CatGroup | null;

  return {
    transaction: {
      id: tx.id,
      description: tx.description,
      merchant_name: tx.merchant_name,
      amount: Number(tx.amount ?? 0),
      date: tx.date,
      icon_url: tx.icon_url ?? null,
    },
    current_category: currentSysCat
      ? {
          id: currentSysCat.id ?? null,
          label: currentSysCat.label ?? 'Uncategorized',
          hex_color: currentSysCat.hex_color ?? '#71717a',
          group_name: currentGroup?.name ?? null,
          group_color: currentGroup?.hex_color ?? null,
          icon_lib: currentGroup?.icon_lib ?? null,
          icon_name: currentGroup?.icon_name ?? null,
        }
      : null,
    suggested_category: {
      id: newCat.id,
      label: newCat.label,
      hex_color: newCat.hex_color ?? '#71717a',
      group_name: newGroup?.name ?? null,
      group_color: newGroup?.hex_color ?? null,
      icon_lib: newGroup?.icon_lib ?? null,
      icon_name: newGroup?.icon_name ?? null,
    },
    reasoning: input.reasoning ?? null,
  };
}
