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
        exclude_transfers: {
          type: 'boolean',
          description:
            'When true, exclude transfer-type categories (credit card ' +
            'payments, account transfers in/out). These are NOT real ' +
            'spending: credit card payments are paying off money already ' +
            "spent in other categories, and account transfers move money " +
            "between the user's own accounts. Recommended when the user " +
            'is talking about spending or budgets, e.g. "what are my loan ' +
            'payments?" should typically show real loan payments (mortgage, ' +
            'auto, student) and exclude credit card payments. Defaults to ' +
            'false (show everything) so the model has to opt in.',
        },
      },
    },
  },
  {
    name: 'get_spending_by_category',
    description:
      "Get a breakdown of spending grouped by category for a given period. " +
      "Use this when the user asks where their money is going, wants to see " +
      "their top spending categories, or asks about spending trends.\n\n" +
      "By default the result renders as a stacked-bar widget with category " +
      "rows. If you only need the data for your own reasoning (e.g. during " +
      "budget consultation, where the breakdown widget would feel redundant " +
      "next to your prose), pass silent: true. The data still comes back to " +
      "you, but no widget renders to the user.",
    input_schema: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['this_month', 'last_month', 'last_30_days', 'last_90_days'],
          description:
            'Time window. this_month and last_month use calendar-month boundaries; ' +
            'last_30_days and last_90_days are rolling. Defaults to this_month.',
        },
        silent: {
          type: 'boolean',
          description:
            'When true, run the query but do NOT render a widget. Use when ' +
            'you need the data for context but a visible breakdown would feel ' +
            "redundant next to what you're going to say in prose.",
        },
        exclude_transfers: {
          type: 'boolean',
          description:
            'When true, exclude transfer-type categories (credit card ' +
            'payments, account transfers). These are NOT real spending and ' +
            'inflate the breakdown. Strongly recommended for budget / ' +
            'spending discussions. Defaults to true since the natural ' +
            'reading of "spending breakdown" excludes transfers.',
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
      "Suggest a category change for one OR MORE transactions. Renders an inline " +
      "confirmation widget with accept/decline buttons — this tool does NOT " +
      "write to the database; the user has to click accept for the change to " +
      "happen. Always call list_categories first so you know the valid " +
      "category_id values.\n\n" +
      "Pass an array of transaction_ids. The widget adapts:\n" +
      "- 1 id → single-row layout showing FROM → TO\n" +
      "- N ids → bulk layout listing all transactions, one accept button applies to all\n\n" +
      "Reach for the bulk shape when the user wants to fix a recurring merchant " +
      "(e.g. 'recategorize all my Dunkin transactions', or 'change my Coffee " +
      "transactions to Fast Food'). Pull the matching transactions with " +
      "get_recent_transactions first, then pass all matching ids in one call. " +
      "Do NOT call this tool multiple times in a row for the same merchant — " +
      "that produces multiple widgets when one bulk widget reads better.\n\n" +
      "If the current category is already best, don't call this tool — just say so.",
    input_schema: {
      type: 'object',
      properties: {
        transaction_ids: {
          type: 'array',
          items: { type: 'string' },
          description:
            'UUIDs of the transactions to recategorize. From get_recent_transactions. ' +
            'Pass one for a single-row widget, multiple for a bulk widget.',
          minItems: 1,
        },
        new_category_id: {
          type: 'string',
          description: 'UUID of the suggested category. From list_categories.',
        },
        reasoning: {
          type: 'string',
          description:
            'One short sentence explaining why. Shown in the widget so the ' +
            'user understands the suggestion. (Currently not rendered, but ' +
            'still passed through for future use — feel free to provide it.)',
        },
      },
      required: ['transaction_ids', 'new_category_id'],
    },
  },
  {
    name: 'get_recurring_transactions',
    description:
      "List recurring payments the user has, detected by Plaid (rent/mortgage, " +
      "subscriptions, utilities, etc). Each has a merchant, frequency, average " +
      "amount, and the last/next predicted dates. Useful when consulting on " +
      "budgets — recurring expenses are the obvious candidates for category " +
      "budgets, and surfacing them helps the user see commitments they might " +
      "have forgotten about. Note: only includes recurring streams that have " +
      "transactions in connected accounts. The user may have other commitments " +
      "(e.g. mortgage paid from an unconnected account) that won't appear here " +
      "— ask about those when consulting.",
    input_schema: {
      type: 'object',
      properties: {
        active_only: {
          type: 'boolean',
          description: 'If true, only return active recurring streams. Defaults to true.',
        },
      },
    },
  },
  {
    name: 'propose_budget_create',
    description:
      "Propose a NEW budget. Renders an inline accept/decline widget; does NOT " +
      "write until the user accepts.\n\n" +
      "Set EITHER category_group_id (preferred — covers all leaf categories " +
      "under that group, e.g. all Food and Drink) OR category_id (specific " +
      "leaf, e.g. just Coffee Shops). NOT both.\n\n" +
      "Use during budget consultation: after gathering context (current " +
      "budgets, spending breakdown, recurring streams, user's commitments), " +
      "propose budgets one at a time so the user can accept each on its own. " +
      "Don't dump 8 widgets in a single response — that's overwhelming.",
    input_schema: {
      type: 'object',
      properties: {
        category_group_id: {
          type: 'string',
          description: 'UUID of the category group. From list_categories.',
        },
        category_id: {
          type: 'string',
          description:
            'UUID of a specific leaf category. Use category_group_id instead unless the user wants a budget on just one leaf.',
        },
        amount: {
          type: 'number',
          description: 'Monthly budget amount in dollars (positive number).',
          minimum: 0.01,
        },
        reasoning: {
          type: 'string',
          description:
            'Optional one-sentence explanation of why this amount. The widget does not currently render it but pass it through anyway.',
        },
      },
      required: ['amount'],
    },
  },
  {
    name: 'propose_budget_update',
    description:
      "Propose changing an EXISTING budget's amount. Renders an inline " +
      "accept/decline widget showing OLD → NEW. Pass the budget_id from " +
      "get_budgets, plus the new amount.\n\n" +
      "Use when the user says things like 'raise my dining budget to $600' " +
      "or 'lower my groceries budget'. If they want to change which category " +
      "a budget tracks, propose a delete + create instead.",
    input_schema: {
      type: 'object',
      properties: {
        budget_id: {
          type: 'string',
          description: 'UUID of the existing budget. From get_budgets.',
        },
        new_amount: {
          type: 'number',
          description: 'New monthly amount (positive number).',
          minimum: 0.01,
        },
        reasoning: {
          type: 'string',
          description: 'Optional one-sentence explanation.',
        },
      },
      required: ['budget_id', 'new_amount'],
    },
  },
  {
    name: 'propose_budget_delete',
    description:
      "Propose removing an existing budget. Renders an inline accept/decline " +
      "widget. Pass the budget_id from get_budgets. Use when the user wants to " +
      "stop tracking a category, or when a budget no longer fits their life.",
    input_schema: {
      type: 'object',
      properties: {
        budget_id: {
          type: 'string',
          description: 'UUID of the budget to delete. From get_budgets.',
        },
        reasoning: {
          type: 'string',
          description: 'Optional one-sentence explanation.',
        },
      },
      required: ['budget_id'],
    },
  },
  {
    name: 'propose_income_update',
    description:
      "Propose setting (or updating) the user's monthly take-home income. " +
      "Renders an inline accept/decline widget; does NOT write until the user " +
      "accepts. Once accepted, the value lands on user_profiles.monthly_income " +
      "and is visible to both you (in the User profile block at the top of " +
      "this prompt every chat) and the existing budgets page UI.\n\n" +
      "Use this when:\n" +
      "- The user's monthly_income is NOT SET and you need it for budget consultation\n" +
      "- The user mentions a raise, job change, or correction to their income\n" +
      "- You've inferred income from get_recurring_transactions and want to confirm\n\n" +
      "Pass take-home (post-tax) income unless the user explicitly says gross. " +
      "See the 'Determining real monthly income' section of this prompt for " +
      "how to compute the right number from recurring streams (filter out tax " +
      "refunds, account transfers, credit card payments — all show as inflows " +
      "but aren't real income).",
    input_schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description:
            "The monthly take-home income amount in dollars (positive number). " +
            'Pass the whole number, e.g. 6400 for $6,400/month.',
          minimum: 0.01,
        },
        reasoning: {
          type: 'string',
          description:
            'One short sentence explaining how you arrived at this number ' +
            '(e.g. "Two biweekly paychecks averaging $2,950 each from your employer").',
        },
      },
      required: ['amount'],
    },
  },
  {
    name: 'remember_user_fact',
    description:
      "Save a short fact about the user that should persist across " +
      "conversations. Loaded into your system prompt at the start of " +
      "every chat so you don't have to ask the user to repeat themselves.\n\n" +
      "USE for things that are:\n" +
      "- Durable: commitments, preferences, household composition, financial setup\n" +
      "- NOT visible in connected-account data (e.g. mortgage paid from an unconnected account)\n" +
      "- Volunteered by the user in the current conversation\n\n" +
      "DON'T use for things that are:\n" +
      "- Already in the database (account names, transactions, budgets — call the read tools)\n" +
      "- Temporary or contradictable (\"I'm trying to spend less this month\")\n" +
      "- Conversational filler\n\n" +
      "Keep each fact short and standalone (under 200 characters). " +
      "Phrase in third person (\"User has...\"). One fact per call. " +
      "If you saved something the user disagrees with, they can delete " +
      "it from the agent settings page; you can also be told to forget " +
      "specific things in conversation.\n\n" +
      "Examples:\n" +
      "- 'User has a $4,858/mo mortgage with LoanDepot, paid from an unconnected account.'\n" +
      "- 'User has 2 kids in elementary school.'\n" +
      "- 'User prefers brief, casual responses over thorough explanations.'\n" +
      "- 'User\\'s side hustle income is roughly $1,500/mo, deposited to their primary checking.'",
    input_schema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description:
            'The fact to remember. One short standalone sentence in third person. Max 1000 chars but aim for under 200.',
          minLength: 1,
          maxLength: 1000,
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'propose_category_rule',
    description:
      "Propose a permanent category rule that auto-categorizes future " +
      "transactions matching a pattern. Renders an inline accept/decline widget; " +
      "does NOT write until the user accepts.\n\n" +
      "Use this in two situations:\n" +
      "1. AFTER a successful bulk recategorization, when the user says they'd " +
      "   like the same change to apply going forward.\n" +
      "2. When the user explicitly asks for automation up front (e.g. " +
      "   'always categorize Dunkin as Fast Food', 'every Spotify charge is " +
      "   entertainment').\n\n" +
      "Rules apply to FUTURE transactions automatically (during Plaid sync). " +
      "They do NOT retroactively touch existing transactions — pair with " +
      "propose_recategorization (in a separate turn or earlier in this turn) " +
      "if the user wants to fix existing ones too.\n\n" +
      "Conditions are AND-ed together. The most common shape is a single " +
      "merchant_name match: [{ field: 'merchant_name', operator: 'contains', " +
      "value: 'Dunkin' }]. Match on 'merchant_name' when available; fall back " +
      "to 'description' for transactions where merchant_name is null.",
    input_schema: {
      type: 'object',
      properties: {
        category_id: {
          type: 'string',
          description: 'UUID of the target category for the rule. From list_categories.',
        },
        conditions: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                enum: ['merchant_name', 'description', 'amount'],
              },
              operator: {
                type: 'string',
                enum: [
                  'is',
                  'equals',
                  'contains',
                  'starts_with',
                  'is_greater_than',
                  'is_less_than',
                ],
              },
              value: {
                description: 'Match value. String for text fields, number for amount.',
              },
            },
            required: ['field', 'operator', 'value'],
          },
          description:
            'Match conditions. ALL must match for the rule to apply. Most rules ' +
            'are a single merchant_name contains check.',
        },
        reasoning: {
          type: 'string',
          description:
            'Optional short sentence explaining the rule. Shown in the widget so the user understands what they\'re accepting.',
        },
      },
      required: ['category_id', 'conditions'],
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
  | 'get_recurring_transactions'
  | 'propose_recategorization'
  | 'propose_category_rule'
  | 'propose_budget_create'
  | 'propose_budget_update'
  | 'propose_budget_delete'
  | 'propose_income_update'
  | 'remember_user_fact';

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
  exclude_transfers?: boolean;
}
interface SpendingByCategoryInput {
  period?: 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days';
  silent?: boolean;
  exclude_transfers?: boolean;
}

// Category labels we treat as "transfers" / non-spending. Both directions
// of credit card payments and account transfers count. We match by
// case-insensitive substring against the leaf category label so common
// variants ("Credit Card Payment", "credit card payments", "Transfer Out")
// all hit. Group-level matches (e.g. parent group "Loan Payments")
// are NOT excluded — only the specific transfer-flavored leaves.
const TRANSFER_CATEGORY_NEEDLES = [
  'credit card payment',
  'account transfer',
  'transfer in',
  'transfer out',
];

function isTransferCategory(label: string | null | undefined): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  return TRANSFER_CATEGORY_NEEDLES.some((n) => lower.includes(n));
}
interface ProposeRecategorizationInput {
  transaction_ids?: string[];
  new_category_id?: string;
  reasoning?: string;
}

interface CategoryRuleCondition {
  field?: string;
  operator?: string;
  value?: string | number;
}

interface ProposeCategoryRuleInput {
  category_id?: string;
  conditions?: CategoryRuleCondition[];
  reasoning?: string;
}

interface GetRecurringTransactionsInput {
  active_only?: boolean;
}

interface ProposeBudgetCreateInput {
  category_id?: string;
  category_group_id?: string;
  amount?: number;
  reasoning?: string;
}

interface ProposeBudgetUpdateInput {
  budget_id?: string;
  new_amount?: number;
  reasoning?: string;
}

interface ProposeBudgetDeleteInput {
  budget_id?: string;
  reasoning?: string;
}

interface RememberUserFactInput {
  content?: string;
}

interface ProposeIncomeUpdateInput {
  amount?: number;
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
      case 'propose_category_rule':
        return await proposeCategoryRule(
          userId,
          (input as ProposeCategoryRuleInput) ?? {},
        );
      case 'get_recurring_transactions':
        return await getRecurringTransactions(
          userId,
          (input as GetRecurringTransactionsInput) ?? {},
        );
      case 'propose_budget_create':
        return await proposeBudgetCreate(
          userId,
          (input as ProposeBudgetCreateInput) ?? {},
        );
      case 'propose_budget_update':
        return await proposeBudgetUpdate(
          userId,
          (input as ProposeBudgetUpdateInput) ?? {},
        );
      case 'propose_budget_delete':
        return await proposeBudgetDelete(
          userId,
          (input as ProposeBudgetDeleteInput) ?? {},
        );
      case 'remember_user_fact':
        return await rememberUserFact(
          userId,
          (input as RememberUserFactInput) ?? {},
        );
      case 'propose_income_update':
        return await proposeIncomeUpdate(
          userId,
          (input as ProposeIncomeUpdateInput) ?? {},
        );
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    console.error(`[agent:tool:${name}] failed`, err);
    return {
      error: extractErrorMessage(err, name),
    };
  }
}

/**
 * Best-effort error message extraction. Handles three common shapes:
 * - Real Error instances (rare for our codebase but possible)
 * - Supabase / postgrest errors: plain objects with { message, code,
 *   details, hint }. These are NOT Error instances, so a naive
 *   `err instanceof Error` check skips them and falls through to a
 *   generic message.
 * - Anything else: stringify or fall back to a tool-tagged generic.
 *
 * Without this, Supabase failures surface to the user as the unhelpful
 * "Tool execution failed" instead of the actual postgres error
 * ("relation 'budgets' does not exist", "duplicate key value violates
 * unique constraint", etc).
 */
function extractErrorMessage(err: unknown, toolName: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string' && obj.message.length > 0) {
      // Postgres errors often include a hint that's more helpful than
      // the bare message. Append it when it adds value.
      const hint =
        typeof obj.hint === 'string' && obj.hint.length > 0
          ? ` (${obj.hint})`
          : '';
      return `${obj.message}${hint}`;
    }
    // Fallback: try to stringify, but cap length so we don't spew JSON
    // into the chat.
    try {
      const json = JSON.stringify(err);
      if (json && json !== '{}') return json.slice(0, 200);
    } catch {
      // ignore
    }
  }
  return `${toolName} failed`;
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
    // Multi-word merchant queries are surprisingly fragile. The user
    // says "loan depot" but the data has "loanDepot" (no space) because
    // that's how the company brands itself. ILIKE doesn't fuzzy-match
    // whitespace, so a literal "loan depot" search misses the
    // unspaced form entirely. To catch both, OR in a second pair of
    // ilikes against the de-spaced query when the original has any
    // whitespace. No-op for single-word queries.
    const compactQuery = merchantQuery.replace(/\s+/g, '');
    const variations =
      compactQuery && compactQuery !== merchantQuery
        ? [merchantQuery, compactQuery]
        : [merchantQuery];
    const orClauses = variations
      .flatMap((v) => [`description.ilike.%${v}%`, `merchant_name.ilike.%${v}%`])
      .join(',');
    query = query.or(orClauses);
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
      // Drop transfer-type categories when the model opts in. This is
      // a leaf-label match (e.g. "Credit Card Payment", "Account
      // Transfer Out") so the parent group ("Loan Payments") still
      // contains real loan rows.
      if (input.exclude_transfers && isTransferCategory(t.category)) {
        return false;
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

  // Default true for the spending breakdown: the natural reading of
  // "spending breakdown" excludes transfers. The model can opt back in
  // by passing exclude_transfers: false.
  const excludeTransfers = input.exclude_transfers !== false;

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
    // Drop transfer-flavored leaf categories (credit card payments,
    // account transfers). They double-count spending the user already
    // incurred elsewhere (CC payments) or move money between owned
    // buckets (transfers), so a "spending breakdown" that includes
    // them inflates totals and clutters the top-categories list.
    if (excludeTransfers && isTransferCategory(cat?.label)) continue;
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
    excluded_transfers: excludeTransfers,
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

type CatGroupRow = {
  name?: string | null;
  icon_lib?: string | null;
  icon_name?: string | null;
  hex_color?: string | null;
};

type CategoryShape = {
  id: string | null;
  label: string;
  hex_color: string;
  group_name: string | null;
  group_color: string | null;
  icon_lib: string | null;
  icon_name: string | null;
};

function shapeCategory(
  cat: {
    id?: string | null;
    label?: string | null;
    hex_color?: string | null;
    category_groups?: CatGroupRow | null;
  } | null,
): CategoryShape | null {
  if (!cat) return null;
  const group = cat.category_groups ?? null;
  return {
    id: cat.id ?? null,
    label: cat.label ?? 'Uncategorized',
    hex_color: cat.hex_color ?? '#71717a',
    group_name: group?.name ?? null,
    group_color: group?.hex_color ?? null,
    icon_lib: group?.icon_lib ?? null,
    icon_name: group?.icon_name ?? null,
  };
}

async function proposeRecategorization(
  userId: string,
  input: ProposeRecategorizationInput,
) {
  const ids = input.transaction_ids ?? [];
  if (ids.length === 0) {
    return { error: 'transaction_ids must be a non-empty array' };
  }
  if (!input.new_category_id) {
    return { error: 'new_category_id is required' };
  }

  // Fetch all the transactions in one query, scoped to the user via
  // accounts!inner. The .in() filter accepts the array directly.
  const { data: txs, error: txError } = await supabaseAdmin
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
    .in('id', ids)
    .eq('accounts.user_id', userId);

  if (txError) throw txError;
  if (!txs || txs.length === 0) {
    return {
      error: 'No matching transactions found, or none belong to this user.',
    };
  }
  if (txs.length !== ids.length) {
    const found = new Set(txs.map((t) => t.id));
    const missing = ids.filter((id) => !found.has(id));
    return { error: `Some transactions not found: ${missing.join(', ')}` };
  }

  // No-op detection — if every transaction is already in the target,
  // there's nothing to do. Surface as error so the model self-corrects
  // rather than rendering a confusing "from X to X" widget.
  const allInTarget = txs.every(
    (t) => t.category_id === input.new_category_id,
  );
  if (allInTarget) {
    return {
      error:
        'All transactions are already in that category. Nothing to recategorize. Just say so in your response.',
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

  // If every transaction shares the same current category, we can show
  // a meaningful FROM in the widget. If categories differ across the
  // batch, FROM is genuinely "mixed" — leave it null and the widget
  // will only render the TO line.
  const currentCategoryIds = new Set(
    txs.map((t) => t.category_id ?? '__null__'),
  );
  const sharedCurrent =
    currentCategoryIds.size === 1
      ? (txs[0].system_categories as Parameters<typeof shapeCategory>[0])
      : null;

  return {
    transactions: txs.map((t) => ({
      id: t.id,
      description: t.description,
      merchant_name: t.merchant_name,
      amount: Number(t.amount ?? 0),
      date: t.date,
      icon_url: t.icon_url ?? null,
    })),
    current_category: shapeCategory(sharedCurrent),
    suggested_category: shapeCategory(
      newCat as Parameters<typeof shapeCategory>[0],
    )!,
    reasoning: input.reasoning ?? null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Category rules — propose a permanent auto-categorization rule
// ──────────────────────────────────────────────────────────────────────────

const ALLOWED_RULE_FIELDS = new Set([
  'merchant_name',
  'description',
  'amount',
]);
const ALLOWED_RULE_OPERATORS = new Set([
  'is',
  'equals',
  'contains',
  'starts_with',
  'is_greater_than',
  'is_less_than',
]);

async function proposeCategoryRule(
  userId: string,
  input: ProposeCategoryRuleInput,
) {
  if (!input.category_id) {
    return { error: 'category_id is required' };
  }
  const conditions = input.conditions ?? [];
  if (conditions.length === 0) {
    return { error: 'conditions must be a non-empty array' };
  }

  // Validate each condition — sanitize so the widget and downstream
  // upsert get clean data and the model can't smuggle in unexpected
  // operators or fields.
  const normalized: { field: string; operator: string; value: string | number }[] = [];
  for (const c of conditions) {
    if (!c.field || !ALLOWED_RULE_FIELDS.has(c.field)) {
      return {
        error: `Invalid field: ${c.field}. Allowed: ${Array.from(ALLOWED_RULE_FIELDS).join(', ')}`,
      };
    }
    if (!c.operator || !ALLOWED_RULE_OPERATORS.has(c.operator)) {
      return {
        error: `Invalid operator: ${c.operator}. Allowed: ${Array.from(ALLOWED_RULE_OPERATORS).join(', ')}`,
      };
    }
    if (c.value === undefined || c.value === null || c.value === '') {
      return { error: `Condition is missing a value: ${c.field} ${c.operator} ?` };
    }
    normalized.push({
      field: c.field,
      operator: c.operator,
      value: c.value,
    });
  }

  const { data: cat, error: catError } = await supabaseAdmin
    .from('system_categories')
    .select(
      `id, label, hex_color,
       category_groups(name, icon_lib, icon_name, hex_color)`,
    )
    .eq('id', input.category_id)
    .maybeSingle();

  if (catError) throw catError;
  if (!cat) return { error: `Category not found: ${input.category_id}` };

  // Optional — count the user's existing transactions that match the
  // FIRST condition (cheap, indicative). Skipped for amount-based rules
  // since those need numeric handling we don't bother with here.
  let approxMatchCount: number | null = null;
  const head = normalized[0];
  if (head.field !== 'amount') {
    const { count } = await supabaseAdmin
      .from('transactions')
      .select('id, accounts!inner(user_id)', {
        count: 'exact',
        head: true,
      })
      .eq('accounts.user_id', userId)
      .ilike(head.field, `%${head.value}%`);
    approxMatchCount = count ?? null;
  }

  // Mark which user_id this rule is FOR — useful for the rule-creation
  // endpoint, harmless to expose to the widget (it's the caller's id).
  return {
    user_id: userId,
    category: shapeCategory(cat as Parameters<typeof shapeCategory>[0])!,
    conditions: normalized,
    reasoning: input.reasoning ?? null,
    approx_match_count: approxMatchCount,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Recurring transactions — read tool surfacing detected recurring streams
// ──────────────────────────────────────────────────────────────────────────

async function getRecurringTransactions(
  userId: string,
  input: GetRecurringTransactionsInput,
) {
  const activeOnly = input.active_only ?? true;

  let query = supabaseAdmin
    .from('recurring_streams')
    .select(
      `
        id, merchant_name, description, average_amount, last_amount,
        frequency, last_date, predicted_next_date, status, stream_type,
        is_active, category_primary, category_detailed
      `,
    )
    .eq('user_id', userId)
    .order('last_date', { ascending: false });

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  const streams = (data ?? []).map((s) => ({
    id: s.id,
    merchant: s.merchant_name ?? s.description,
    average_amount: Number(s.average_amount ?? 0),
    last_amount: Number(s.last_amount ?? 0),
    frequency: s.frequency,
    last_date: s.last_date,
    next_predicted_date: s.predicted_next_date,
    direction: (Number(s.average_amount) >= 0 ? 'inflow' : 'outflow') as
      | 'inflow'
      | 'outflow',
    plaid_category: s.category_detailed ?? s.category_primary ?? null,
    is_active: s.is_active,
  }));

  // Sort outflows by absolute amount descending so the model sees the
  // biggest recurring expenses first when consulting on budgets.
  streams.sort((a, b) => Math.abs(b.average_amount) - Math.abs(a.average_amount));

  return {
    count: streams.length,
    streams,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Budget proposals — create / update / delete (gated by user accept)
// ──────────────────────────────────────────────────────────────────────────

type BudgetTargetCategory = {
  id: string;
  label: string;
  hex_color: string;
  // For group-budgets, group_* fields are the same as the top-level
  // identity (since the group IS the target). For category-budgets,
  // group_* describes the parent group. Lets the widget render
  // consistent visuals (colored dot from group color, label from
  // group/leaf as appropriate).
  group_name: string | null;
  group_color: string | null;
  icon_lib: string | null;
  icon_name: string | null;
  scope: 'group' | 'category';
};

async function fetchBudgetTargetByGroup(
  groupId: string,
): Promise<BudgetTargetCategory | { error: string }> {
  const { data, error } = await supabaseAdmin
    .from('category_groups')
    .select('id, name, hex_color, icon_lib, icon_name')
    .eq('id', groupId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { error: `Category group not found: ${groupId}` };
  return {
    id: data.id,
    label: data.name,
    hex_color: data.hex_color ?? '#71717a',
    group_name: data.name,
    group_color: data.hex_color ?? null,
    icon_lib: data.icon_lib ?? null,
    icon_name: data.icon_name ?? null,
    scope: 'group',
  };
}

async function fetchBudgetTargetByCategory(
  categoryId: string,
): Promise<BudgetTargetCategory | { error: string }> {
  const { data, error } = await supabaseAdmin
    .from('system_categories')
    .select(
      `id, label, hex_color,
       category_groups(name, hex_color, icon_lib, icon_name)`,
    )
    .eq('id', categoryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { error: `Category not found: ${categoryId}` };
  const group = data.category_groups as
    | {
        name?: string | null;
        hex_color?: string | null;
        icon_lib?: string | null;
        icon_name?: string | null;
      }
    | null;
  return {
    id: data.id,
    label: data.label,
    hex_color: data.hex_color ?? '#71717a',
    group_name: group?.name ?? null,
    group_color: group?.hex_color ?? null,
    icon_lib: group?.icon_lib ?? null,
    icon_name: group?.icon_name ?? null,
    scope: 'category',
  };
}

async function proposeBudgetCreate(
  userId: string,
  input: ProposeBudgetCreateInput,
) {
  if (typeof input.amount !== 'number' || !(input.amount > 0)) {
    return { error: 'amount must be a positive number' };
  }
  if (!input.category_group_id && !input.category_id) {
    return {
      error:
        'Set either category_group_id (preferred) or category_id. Neither was provided.',
    };
  }
  if (input.category_group_id && input.category_id) {
    return {
      error:
        'Set EITHER category_group_id OR category_id, not both. Pick one scope.',
    };
  }

  // Reject duplicates — a user shouldn't have two budgets for the same
  // category/group. Direct them toward propose_budget_update instead.
  const dupQuery = supabaseAdmin
    .from('budgets')
    .select('id, amount')
    .eq('user_id', userId);
  const { data: existing } = input.category_group_id
    ? await dupQuery.eq('category_group_id', input.category_group_id).maybeSingle()
    : await dupQuery.eq('category_id', input.category_id!).maybeSingle();

  if (existing) {
    return {
      error:
        `A budget for this category already exists (id: ${existing.id}, amount: $${existing.amount}). ` +
        `Use propose_budget_update to change the amount, or propose_budget_delete to remove it.`,
    };
  }

  const target = input.category_group_id
    ? await fetchBudgetTargetByGroup(input.category_group_id)
    : await fetchBudgetTargetByCategory(input.category_id!);
  if ('error' in target) return target;

  return {
    action: 'create' as const,
    target,
    amount: input.amount,
    reasoning: input.reasoning ?? null,
  };
}

async function proposeBudgetUpdate(
  userId: string,
  input: ProposeBudgetUpdateInput,
) {
  if (!input.budget_id) {
    return { error: 'budget_id is required' };
  }
  if (typeof input.new_amount !== 'number' || !(input.new_amount > 0)) {
    return { error: 'new_amount must be a positive number' };
  }

  const { data: budget, error } = await supabaseAdmin
    .from('budgets')
    .select('id, amount, category_id, category_group_id, period, user_id')
    .eq('id', input.budget_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!budget) {
    return { error: `Budget not found, or doesn't belong to this user: ${input.budget_id}` };
  }

  if (Math.abs(Number(budget.amount) - input.new_amount) < 0.01) {
    return {
      error:
        `That's already the budget's current amount ($${budget.amount}). Nothing to change.`,
    };
  }

  const target = budget.category_group_id
    ? await fetchBudgetTargetByGroup(budget.category_group_id)
    : budget.category_id
      ? await fetchBudgetTargetByCategory(budget.category_id)
      : null;
  if (!target || 'error' in (target ?? {})) {
    return { error: "Budget's target category could not be loaded" };
  }

  return {
    action: 'update' as const,
    budget_id: budget.id,
    target: target as BudgetTargetCategory,
    current_amount: Number(budget.amount),
    amount: input.new_amount,
    reasoning: input.reasoning ?? null,
  };
}

async function proposeBudgetDelete(
  userId: string,
  input: ProposeBudgetDeleteInput,
) {
  if (!input.budget_id) {
    return { error: 'budget_id is required' };
  }

  const { data: budget, error } = await supabaseAdmin
    .from('budgets')
    .select('id, amount, category_id, category_group_id, period, user_id')
    .eq('id', input.budget_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!budget) {
    return { error: `Budget not found, or doesn't belong to this user: ${input.budget_id}` };
  }

  const target = budget.category_group_id
    ? await fetchBudgetTargetByGroup(budget.category_group_id)
    : budget.category_id
      ? await fetchBudgetTargetByCategory(budget.category_id)
      : null;
  if (!target || 'error' in (target ?? {})) {
    return { error: "Budget's target category could not be loaded" };
  }

  return {
    action: 'delete' as const,
    budget_id: budget.id,
    target: target as BudgetTargetCategory,
    current_amount: Number(budget.amount),
    reasoning: input.reasoning ?? null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Memories — persistent facts the agent saves about the user
// ──────────────────────────────────────────────────────────────────────────

async function rememberUserFact(userId: string, input: RememberUserFactInput) {
  const content = input.content?.trim() ?? '';
  if (content.length === 0) {
    return { error: 'content is required' };
  }
  if (content.length > 1000) {
    return { error: 'content must be 1000 characters or fewer' };
  }

  // Soft dedupe — if the user already has the exact same active memory,
  // don't insert a second copy. The model occasionally calls the tool
  // with slight variations, but exact duplicates would just clutter.
  const { data: existing } = await supabaseAdmin
    .from('user_agent_memories')
    .select('id, content')
    .eq('user_id', userId)
    .eq('is_active', true)
    .eq('content', content)
    .maybeSingle();

  if (existing) {
    return {
      action: 'remember' as const,
      memory_id: existing.id,
      content: existing.content,
      duplicate: true,
    };
  }

  const { data, error } = await supabaseAdmin
    .from('user_agent_memories')
    .insert({
      user_id: userId,
      content,
      source: 'agent',
    })
    .select('id, content')
    .single();

  if (error) {
    console.error('[agent:remember_user_fact] insert failed', error);
    return { error: 'Failed to save memory' };
  }

  return {
    action: 'remember' as const,
    memory_id: data.id,
    content: data.content,
    duplicate: false,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Income — propose updating user_profiles.monthly_income
// ──────────────────────────────────────────────────────────────────────────

async function proposeIncomeUpdate(
  userId: string,
  input: ProposeIncomeUpdateInput,
) {
  if (typeof input.amount !== 'number' || !(input.amount > 0)) {
    return { error: 'amount must be a positive number' };
  }

  // Pull the current income so the widget can show OLD → NEW when the
  // user already has a value set. First-time set just shows the new
  // value.
  const { data: profile } = await supabaseAdmin
    .from('user_profiles')
    .select('monthly_income')
    .eq('id', userId)
    .maybeSingle();

  const currentAmount =
    typeof profile?.monthly_income === 'number'
      ? Number(profile.monthly_income)
      : null;

  // No-op detection — if the proposed amount exactly matches what's
  // already set, surface as error so the model can self-correct
  // rather than rendering a confusing "from X to X" widget.
  if (currentAmount !== null && Math.abs(currentAmount - input.amount) < 0.01) {
    return {
      error:
        `That's already the user's monthly income ($${currentAmount}). Nothing to change.`,
    };
  }

  return {
    action: currentAmount === null ? ('set' as const) : ('update' as const),
    current_amount: currentAmount,
    amount: input.amount,
    reasoning: input.reasoning ?? null,
  };
}
