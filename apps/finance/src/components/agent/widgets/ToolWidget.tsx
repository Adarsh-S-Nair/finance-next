"use client";

import { motion } from "framer-motion";
import BudgetListWidget, { type BudgetListData } from "./BudgetListWidget";
import TransactionListWidget, { type TransactionListData } from "./TransactionListWidget";
import SpendingBreakdownWidget, { type SpendingBreakdownData } from "./SpendingBreakdownWidget";
import AccountListWidget, { type AccountListData } from "./AccountListWidget";
import RecategorizationWidget, {
  type RecategorizationData,
} from "./RecategorizationWidget";

const TOOL_LABELS: Record<string, string> = {
  get_budgets: "Looking up your budgets",
  get_recent_transactions: "Pulling recent transactions",
  get_spending_by_category: "Computing spending breakdown",
  get_account_balances: "Loading account balances",
  list_categories: "Loading categories",
  propose_recategorization: "Preparing suggestion",
};

// Tools that produce data the model uses internally but isn't useful to
// render. We skip the loading row entirely so the user doesn't see a
// "loading categories…" flash that vanishes a beat later. The loading
// row IS still shown for tools whose results render — it provides
// a visible "thinking" indicator while a real widget is on its way.
const HIDDEN_TOOLS = new Set<string>(["list_categories"]);

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
 */
export default function ToolWidget({ tool }: { tool: ToolBlock }) {
  // Hidden tools render nothing — neither during execution nor after.
  // This avoids a "Loading categories" row that briefly appears then
  // disappears for tools whose result the user shouldn't see.
  if (HIDDEN_TOOLS.has(tool.name)) return null;

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
