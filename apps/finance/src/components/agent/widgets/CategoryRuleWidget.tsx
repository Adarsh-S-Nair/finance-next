"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiX, FiTag } from "react-icons/fi";
import { Button } from "@zervo/ui";
import DynamicIcon from "../../DynamicIcon";
import { formatCurrency } from "../../../lib/formatCurrency";
import { authFetch } from "../../../lib/api/fetch";
import { WidgetError, WidgetFrame } from "./primitives";
import { PagedList } from "./PagedList";

type Category = {
  id: string | null;
  label: string;
  hex_color: string;
  group_name: string | null;
  group_color: string | null;
  icon_lib: string | null;
  icon_name: string | null;
};

type RuleCondition = {
  field: string;
  operator: string;
  value: string | number;
};

type MatchingTransaction = {
  id: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  date: string | null;
  icon_url: string | null;
  category_label: string | null;
  category_color: string | null;
  category_icon_lib: string | null;
  category_icon_name: string | null;
};

export type CategoryRuleData = {
  category: Category;
  conditions: RuleCondition[];
  reasoning: string | null;
  approx_match_count: number | null;
  // Optional: only present when the tool was rerun after this widget was
  // updated to surface a preview list. Older persisted conversations
  // won't have it.
  matching_transactions?: MatchingTransaction[];
  error?: string;
};

type WidgetState =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "committing" }
  | { kind: "accepted"; silent: boolean; appliedToExisting: number | null }
  | { kind: "declined"; silent: boolean }
  | { kind: "failed"; message: string };

const FIELD_LABEL: Record<string, string> = {
  merchant_name: "merchant",
  description: "description",
  amount: "amount",
};

const OP_LABEL: Record<string, string> = {
  is: "is",
  equals: "equals",
  contains: "contains",
  starts_with: "starts with",
  is_greater_than: "is greater than",
  is_less_than: "is less than",
};

function categoryColor(cat: Category | null | undefined): string {
  if (!cat) return "#71717a";
  return cat.hex_color || cat.group_color || "#71717a";
}

function formatConditionValue(c: RuleCondition): string {
  if (c.field === "amount") {
    const num = Number(c.value);
    if (Number.isFinite(num)) {
      return `$${num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
  }
  return String(c.value);
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function CategoryRuleWidget({
  toolUseId,
  data,
}: {
  toolUseId: string;
  data: CategoryRuleData;
}) {
  const [state, setState] = useState<WidgetState>({ kind: "checking" });
  // Default: opt INTO retroactive application when there are matches —
  // the most natural ask ("auto-categorize Gemini going forward") usually
  // implies "and fix the existing ones too". Hidden when no matches.
  const [applyToExisting, setApplyToExisting] = useState(true);

  // Mount-time check: did the user already accept/decline this proposal
  // in a previous session?
  useEffect(() => {
    if (data.error) return;
    let cancelled = false;
    async function check() {
      try {
        const res = await authFetch(
          `/api/agent/widget-actions/${encodeURIComponent(toolUseId)}`,
        );
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { action?: string | null };
          if (cancelled) return;
          if (body.action === "accepted") {
            setState({
              kind: "accepted",
              silent: true,
              appliedToExisting: null,
            });
            return;
          }
          if (body.action === "declined") {
            setState({ kind: "declined", silent: true });
            return;
          }
        }
      } catch {
        // Fall through to idle.
      }
      if (!cancelled) setState({ kind: "idle" });
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [toolUseId, data.error]);

  if (data.error) return <WidgetError message={data.error} />;

  const matchCount = data.approx_match_count ?? 0;
  const matchingTxs = data.matching_transactions ?? [];
  const showApplyToggle = matchCount > 0;

  async function handleAccept() {
    setState({ kind: "committing" });
    try {
      const res = await authFetch("/api/agent/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: data.category.id,
          conditions: data.conditions,
          apply_to_existing: showApplyToggle && applyToExisting,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string })?.error || `Failed (${res.status})`,
        );
      }
      const body = (await res.json().catch(() => ({}))) as {
        applied_to_existing?: number | null;
      };
      await authFetch("/api/agent/widget-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_use_id: toolUseId,
          action: "accepted",
        }),
      });
      setState({
        kind: "accepted",
        silent: false,
        appliedToExisting: body.applied_to_existing ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed";
      setState({ kind: "failed", message });
    }
  }

  async function handleDecline() {
    setState({ kind: "declined", silent: false });
    try {
      await authFetch("/api/agent/widget-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_use_id: toolUseId,
          action: "declined",
        }),
      });
    } catch {
      // Silent.
    }
  }

  if (state.kind === "checking") {
    return <WidgetFrame>{null}</WidgetFrame>;
  }

  return (
    <WidgetFrame>
      <AnimatePresence mode="wait" initial={false}>
        {state.kind === "accepted" ? (
          <ResolvedState
            key="accepted"
            tone="accepted"
            data={data}
            silent={state.silent}
            appliedToExisting={state.appliedToExisting}
          />
        ) : state.kind === "declined" ? (
          <ResolvedState
            key="declined"
            tone="declined"
            data={data}
            silent={state.silent}
            appliedToExisting={null}
          />
        ) : (
          <ProposalState
            key="proposal"
            data={data}
            matchingTxs={matchingTxs}
            committing={state.kind === "committing"}
            error={state.kind === "failed" ? state.message : null}
            showApplyToggle={showApplyToggle}
            applyToExisting={applyToExisting}
            onApplyToggle={setApplyToExisting}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        )}
      </AnimatePresence>
    </WidgetFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Proposal — WHEN/SET rows, optional preview list, retroactive toggle,
// accept/decline. Order: rule → preview → toggle → buttons. The buttons
// sit BELOW the toggle so the action grouping reads top-down.
// ──────────────────────────────────────────────────────────────────────────

function ProposalState({
  data,
  matchingTxs,
  committing,
  error,
  showApplyToggle,
  applyToExisting,
  onApplyToggle,
  onAccept,
  onDecline,
}: {
  data: CategoryRuleData;
  matchingTxs: MatchingTransaction[];
  committing: boolean;
  error: string | null;
  showApplyToggle: boolean;
  applyToExisting: boolean;
  onApplyToggle: (v: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div className="space-y-2.5">
        {data.conditions.map((c, i) => (
          <RuleConditionRow
            key={i}
            label={i === 0 ? "When" : "And"}
            condition={c}
          />
        ))}
        <RuleSetRow label="Set" cat={data.category} />
      </div>

      {matchingTxs.length > 0 && (
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] mb-2">
            Existing matches
          </div>
          <PagedList
            items={matchingTxs}
            getKey={(tx) => tx.id}
            renderItem={(tx) => <MatchingTransactionRow tx={tx} />}
            empty={null}
          />
        </div>
      )}

      {showApplyToggle && (
        <ApplyToExistingToggle
          count={data.approx_match_count ?? 0}
          checked={applyToExisting}
          onChange={onApplyToggle}
          disabled={committing}
        />
      )}

      {data.reasoning && (
        <p className="text-xs text-[var(--color-muted)] italic">
          {data.reasoning}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-1">
        {error && (
          <span className="text-[11px] text-rose-500 mr-2">{error}</span>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={onDecline}
          disabled={committing}
        >
          Decline
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onAccept}
          loading={committing}
        >
          Create rule
        </Button>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Resolved — accepted/declined terminal state
// ──────────────────────────────────────────────────────────────────────────

function ResolvedState({
  tone,
  data,
  silent,
  appliedToExisting,
}: {
  tone: "accepted" | "declined";
  data: CategoryRuleData;
  silent: boolean;
  appliedToExisting: number | null;
}) {
  return (
    <motion.div
      initial={silent ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-3"
    >
      <div className="space-y-2.5">
        {data.conditions.map((c, i) => (
          <RuleConditionRow
            key={i}
            label={i === 0 ? "When" : "And"}
            condition={c}
            muted
          />
        ))}

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4 pt-1">
          <div className="min-w-0 md:flex-1">
            <RuleSetRow
              label={tone === "accepted" ? "Active" : "Skipped"}
              cat={data.category}
              muted={tone === "declined"}
            />
          </div>
          <motion.div
            initial={silent ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: silent ? 0 : 0.3, duration: 0.25 }}
            className={`flex items-center gap-1.5 text-xs flex-shrink-0 ${
              tone === "accepted"
                ? "text-emerald-500"
                : "text-[var(--color-muted)]"
            }`}
          >
            {tone === "accepted" ? (
              <FiCheck className="h-3.5 w-3.5" strokeWidth={3} />
            ) : (
              <FiX className="h-3.5 w-3.5" strokeWidth={3} />
            )}
            {tone === "accepted" ? "Rule created" : "Rule declined"}
          </motion.div>
        </div>
      </div>

      {tone === "accepted" && appliedToExisting !== null && appliedToExisting > 0 && (
        <div className="text-xs text-[var(--color-muted)]">
          {appliedToExisting === 1
            ? "Recategorized 1 existing transaction to match."
            : `Recategorized ${appliedToExisting} existing transactions to match.`}
        </div>
      )}
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────────────

function RuleConditionRow({
  label,
  condition,
  muted = false,
}: {
  label: string;
  condition: RuleCondition;
  muted?: boolean;
}) {
  const field = FIELD_LABEL[condition.field] ?? condition.field;
  const op = OP_LABEL[condition.operator] ?? condition.operator;
  const value = formatConditionValue(condition);
  const isAmount = condition.field === "amount";
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] w-12 flex-shrink-0">
        {label}
      </span>
      <span className="truncate">
        <span className="text-[var(--color-muted)]">
          {field} {op}{" "}
        </span>
        <span
          className={
            muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)] font-medium"
          }
        >
          {isAmount ? value : `“${value}”`}
        </span>
      </span>
    </div>
  );
}

function RuleSetRow({
  label,
  cat,
  muted = false,
}: {
  label: string;
  cat: Category;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] w-12 flex-shrink-0">
        {label}
      </span>
      <span className="inline-flex items-center gap-2.5 min-w-0">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: categoryColor(cat) }}
        />
        <span
          className={`truncate ${
            muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]"
          }`}
        >
          {cat.label}
        </span>
      </span>
    </div>
  );
}

/**
 * One row in the preview list. Same row shape as TransactionListWidget —
 * merchant icon + name + (date · current category) + amount — so the
 * preview reads as a smaller version of the standard transactions
 * widget that the user already knows.
 */
function MatchingTransactionRow({ tx }: { tx: MatchingTransaction }) {
  const isIncome = tx.amount > 0;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3 min-w-0">
        <MerchantIcon
          iconUrl={tx.icon_url}
          color={tx.category_color}
          iconLib={tx.category_icon_lib}
          iconName={tx.category_icon_name}
        />
        <div className="min-w-0">
          <div className="text-sm text-[var(--color-fg)] truncate">
            {tx.merchant_name || tx.description}
          </div>
          <div className="text-[11px] text-[var(--color-muted)] truncate">
            {formatDate(tx.date)}
            {tx.category_label ? ` · ${tx.category_label}` : ""}
          </div>
        </div>
      </div>
      <div
        className={`text-sm tabular-nums flex-shrink-0 ${
          isIncome ? "text-emerald-500" : "text-[var(--color-fg)]"
        }`}
      >
        {isIncome ? "+" : ""}
        {formatCurrency(tx.amount)}
      </div>
    </div>
  );
}

function MerchantIcon({
  iconUrl,
  color,
  iconLib,
  iconName,
}: {
  iconUrl: string | null;
  color: string | null;
  iconLib: string | null;
  iconName: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  if (iconUrl && !imageFailed) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        onError={() => setImageFailed(true)}
        className="w-7 h-7 rounded-full flex-shrink-0 object-cover bg-[var(--color-surface-alt)]"
      />
    );
  }
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: color || "var(--color-surface-alt)" }}
    >
      <DynamicIcon
        iconLib={iconLib}
        iconName={iconName}
        className="h-3.5 w-3.5 text-white"
        fallback={FiTag}
        style={{ strokeWidth: 2.5 }}
      />
    </div>
  );
}

/**
 * Opt-in toggle to retroactively apply the rule. Defaults checked
 * because the most natural ask ("auto-categorize Gemini going forward")
 * usually implies "and fix the existing ones too".
 */
function ApplyToExistingToggle({
  count,
  checked,
  onChange,
  disabled,
}: {
  count: number;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      disabled={disabled}
      className="flex items-center gap-2.5 text-xs text-left rounded-md hover:bg-[var(--color-surface-alt)]/40 transition-colors -mx-1 px-1 py-1 disabled:opacity-50"
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors flex-shrink-0 ${
          checked
            ? "bg-[var(--color-fg)] border-[var(--color-fg)]"
            : "border-[var(--color-border)] bg-transparent"
        }`}
      >
        {checked && (
          <FiCheck
            className="h-3 w-3 text-[var(--color-bg)]"
            strokeWidth={3.5}
          />
        )}
      </span>
      <span className="text-[var(--color-fg)]">
        Also recategorize{" "}
        <span className="font-medium">
          {count === 1 ? "1 existing match" : `${count} existing matches`}
        </span>
      </span>
    </button>
  );
}
