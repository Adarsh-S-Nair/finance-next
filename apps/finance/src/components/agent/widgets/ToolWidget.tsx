"use client";

import { motion } from "framer-motion";
import BudgetListWidget, { type BudgetListData } from "./BudgetListWidget";
import TransactionListWidget, { type TransactionListData } from "./TransactionListWidget";
import SpendingBreakdownWidget, { type SpendingBreakdownData } from "./SpendingBreakdownWidget";
import AccountListWidget, { type AccountListData } from "./AccountListWidget";
import RecategorizationWidget, {
  type RecategorizationData,
} from "./RecategorizationWidget";
import CategoryRuleWidget, {
  type CategoryRuleData,
} from "./CategoryRuleWidget";
import BudgetProposalWidget, {
  type BudgetProposalData,
} from "./BudgetProposalWidget";
import MemoryWidget, {
  type MemoryWidgetData,
} from "./MemoryWidget";
import IncomeProposalWidget, {
  type IncomeProposalData,
} from "./IncomeProposalWidget";
import QuestionWidget, { type QuestionData } from "./QuestionWidget";

const TOOL_LABELS: Record<string, string> = {
  get_budgets: "Looking up your budgets",
  get_recent_transactions: "Pulling recent transactions",
  get_spending_by_category: "Computing spending breakdown",
  get_account_balances: "Loading account balances",
  list_categories: "Loading categories",
  get_recurring_transactions: "Looking up recurring payments",
  propose_recategorization: "Preparing suggestion",
  propose_category_rule: "Preparing rule",
  propose_budget_create: "Preparing budget proposal",
  propose_budget_update: "Preparing budget update",
  propose_budget_delete: "Preparing budget removal",
  propose_income_update: "Preparing income update",
  remember_user_fact: "Saving to memory",
  ask_user_question: "Asking a question",
};

// Tools that produce data the model uses internally but isn't useful to
// render. We skip the loading row entirely so the user doesn't see a
// "loading categories…" flash that vanishes a beat later. The loading
// row IS still shown for tools whose results render — it provides
// a visible "thinking" indicator while a real widget is on its way.
const HIDDEN_TOOLS = new Set<string>([
  "list_categories",
  "get_recurring_transactions",
  // Internal aggregator the model uses to compute monthly income totals.
  // Result is dense JSON the user shouldn't see — the agent narrates the
  // findings in prose and follows up with an income proposal widget.
  "get_income_summary",
  // Same idea: drilled merchant rollup the agent uses to size category
  // budgets accurately (catches quarterly/annual bills that recurring
  // streams misses). The user sees the resulting budget proposal,
  // not the raw breakdown.
  "get_category_breakdown",
]);

export type ToolBlock = {
  id: string;
  name: string;
  input?: unknown;
  output?: unknown;
  isError?: boolean;
};

/**
 * Maps a tool name + result onto the matching widget. Renders a quiet
 * loading row if the result hasn't arrived yet (the round-trip can take
 * a few hundred ms even for cheap reads). Falls back to a generic
 * display for unknown tools so future additions don't crash the UI.
 *
 * onContinue: optional callback that confirmation widgets fire after a
 * successful accept/decline. Triggers a synthetic continuation chat
 * turn so the agent can keep going (e.g. propose the next budget) without
 * the user having to type "what's next?". Currently only wired to the
 * BudgetProposalWidget since that's the multi-step flow; other widgets
 * accept once and stop.
 */
export default function ToolWidget({
  tool,
  onContinue,
}: {
  tool: ToolBlock;
  onContinue?: (message: string) => void;
}) {
  // Hidden tools render nothing — neither during execution nor after.
  // This avoids a "Loading categories" row that briefly appears then
  // disappears for tools whose result the user shouldn't see.
  if (HIDDEN_TOOLS.has(tool.name)) return null;

  // Per-call silent flag. Some tools (currently get_spending_by_category)
  // accept `silent: true` in their input — the model uses the data for
  // reasoning but doesn't want the widget rendered to the user. We treat
  // a silent call exactly like a hidden tool: no loading row, no widget.
  // Reading the input rather than the output so the loading row is also
  // suppressed while the call is in flight.
  const input = tool.input as { silent?: boolean } | null | undefined;
  if (input?.silent) return null;

  if (!tool.output) {
    return <ToolLoadingRow name={tool.name} />;
  }

  if (tool.isError) {
    const msg =
      (tool.output as { error?: string } | null)?.error ??
      "Something went wrong running this tool.";
    return (
      <div className="my-5 text-xs text-[var(--color-danger)]">
        {TOOL_LABELS[tool.name] ?? tool.name} failed: {msg}
      </div>
    );
  }

  switch (tool.name) {
    case "get_budgets":
      return <BudgetListWidget data={tool.output as BudgetListData} />;
    case "get_recent_transactions":
      return <TransactionListWidget data={tool.output as TransactionListData} />;
    case "get_spending_by_category":
      return <SpendingBreakdownWidget data={tool.output as SpendingBreakdownData} />;
    case "get_account_balances":
      return <AccountListWidget data={tool.output as AccountListData} />;
    case "propose_recategorization":
      // tool.id is Anthropic's tool_use_id — globally unique per
      // proposal. The widget uses it to persist accept/decline state
      // to user_agent_widget_actions so the choice survives reloads.
      return (
        <RecategorizationWidget
          toolUseId={tool.id}
          data={tool.output as RecategorizationData}
        />
      );
    case "propose_category_rule":
      return (
        <CategoryRuleWidget
          toolUseId={tool.id}
          data={tool.output as CategoryRuleData}
        />
      );
    case "propose_budget_create":
    case "propose_budget_update":
    case "propose_budget_delete":
      return (
        <BudgetProposalWidget
          toolUseId={tool.id}
          data={tool.output as BudgetProposalData}
          onContinue={onContinue}
        />
      );
    case "remember_user_fact":
      return <MemoryWidget data={tool.output as MemoryWidgetData} />;
    case "propose_income_update":
      return (
        <IncomeProposalWidget
          toolUseId={tool.id}
          data={tool.output as IncomeProposalData}
          onContinue={onContinue}
        />
      );
    case "ask_user_question":
      return (
        <QuestionWidget
          toolUseId={tool.id}
          data={tool.output as QuestionData}
          onContinue={onContinue}
        />
      );
    default:
      return <UnknownToolFallback name={tool.name} output={tool.output} />;
  }
}

function ToolLoadingRow({ name }: { name: string }) {
  const label = TOOL_LABELS[name] ?? name;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="my-5 flex items-center gap-2 text-xs text-[var(--color-muted)]"
    >
      <ShimmerDots />
      <span>{label}…</span>
    </motion.div>
  );
}

function ShimmerDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-[var(--color-muted)]"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function UnknownToolFallback({ name, output }: { name: string; output: unknown }) {
  return (
    <details className="my-5 text-xs">
      <summary className="text-[var(--color-muted)] cursor-pointer hover:text-[var(--color-fg)] transition-colors">
        Tool: {name}
      </summary>
      <pre className="mt-2 px-3 py-2 rounded-md font-mono overflow-x-auto text-[11px] text-[var(--color-muted)] bg-[var(--color-surface-alt)]/40">
        {JSON.stringify(output, null, 2)}
      </pre>
    </details>
  );
}
