"use client";

import { Fragment, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiX } from "react-icons/fi";
import { Button } from "@zervo/ui";
import { authFetch } from "../../../lib/api/fetch";
import { WidgetError, WidgetFrame } from "./primitives";

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

export type CategoryRuleData = {
  category: Category;
  conditions: RuleCondition[];
  reasoning: string | null;
  approx_match_count: number | null;
  error?: string;
};

type WidgetState =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "committing" }
  | { kind: "accepted"; silent: boolean }
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
  return `“${c.value}”`;
}

export default function CategoryRuleWidget({
  toolUseId,
  data,
}: {
  toolUseId: string;
  data: CategoryRuleData;
}) {
  const [state, setState] = useState<WidgetState>({ kind: "checking" });

  // Same persisted-action check the recat widget uses: on mount, look
  // up whether the user already accepted/declined this proposal in a
  // previous session so the widget rehydrates correctly.
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
            setState({ kind: "accepted", silent: true });
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

  async function handleAccept() {
    setState({ kind: "committing" });
    try {
      const res = await authFetch("/api/agent/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: data.category.id,
          conditions: data.conditions,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string })?.error || `Failed (${res.status})`,
        );
      }
      await authFetch("/api/agent/widget-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tool_use_id: toolUseId,
          action: "accepted",
        }),
      });
      setState({ kind: "accepted", silent: false });
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
          />
        ) : state.kind === "declined" ? (
          <ResolvedState
            key="declined"
            tone="declined"
            data={data}
            silent={state.silent}
          />
        ) : (
          <ProposalState
            key="proposal"
            data={data}
            committing={state.kind === "committing"}
            error={state.kind === "failed" ? state.message : null}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        )}
      </AnimatePresence>
    </WidgetFrame>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Proposal — single sentence describing the rule + accept/decline
// ──────────────────────────────────────────────────────────────────────────

function ProposalState({
  data,
  committing,
  error,
  onAccept,
  onDecline,
}: {
  data: CategoryRuleData;
  committing: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      <RuleSentence
        conditions={data.conditions}
        category={data.category}
        leading="Auto-categorize transactions where"
      />

      <RuleMeta
        approxMatchCount={data.approx_match_count}
        reasoning={data.reasoning}
      />

      <div className="flex items-center justify-end gap-2">
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
}: {
  tone: "accepted" | "declined";
  data: CategoryRuleData;
  silent: boolean;
}) {
  return (
    <motion.div
      initial={silent ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-3"
    >
      <RuleSentence
        conditions={data.conditions}
        category={data.category}
        leading={
          tone === "accepted"
            ? "Auto-categorizing transactions where"
            : "Won't auto-categorize transactions where"
        }
        muted={tone === "declined"}
      />

      <motion.div
        initial={silent ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: silent ? 0 : 0.25, duration: 0.25 }}
        className={`flex items-center gap-1.5 text-xs ${
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
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────────────

/**
 * Renders the rule as a single natural sentence. The condition LHS
 * ("merchant is") is rendered muted; the value the user is matching on
 * is bold. The target category gets a colored dot + label inline.
 * Multi-condition rules read "...where merchant is "Spotify" and amount
 * is greater than $10, as Entertainment."
 */
function RuleSentence({
  conditions,
  category,
  leading,
  muted = false,
}: {
  conditions: RuleCondition[];
  category: Category;
  leading: string;
  muted?: boolean;
}) {
  return (
    <p
      className={`text-sm leading-relaxed ${
        muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]"
      }`}
    >
      <span className="text-[var(--color-muted)]">{leading} </span>
      {conditions.map((c, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-[var(--color-muted)]"> and </span>}
          <span className="text-[var(--color-muted)]">
            {FIELD_LABEL[c.field] ?? c.field} {OP_LABEL[c.operator] ?? c.operator}{" "}
          </span>
          <span className={muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)] font-medium"}>
            {formatConditionValue(c)}
          </span>
        </Fragment>
      ))}
      <span className="text-[var(--color-muted)]">, as </span>
      <CategoryInline cat={category} muted={muted} />
      <span className="text-[var(--color-muted)]">.</span>
    </p>
  );
}

function CategoryInline({ cat, muted = false }: { cat: Category; muted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: categoryColor(cat) }}
      />
      <span
        className={
          muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)] font-medium"
        }
      >
        {cat.label}
      </span>
    </span>
  );
}

/**
 * Secondary context: how many existing transactions the rule would
 * have matched (useful for sanity-checking the rule), and the agent's
 * one-line reasoning if provided. Only renders when at least one is
 * present.
 */
function RuleMeta({
  approxMatchCount,
  reasoning,
}: {
  approxMatchCount: number | null;
  reasoning: string | null;
}) {
  const showCount = approxMatchCount !== null && approxMatchCount > 0;
  if (!showCount && !reasoning) return null;
  return (
    <div className="text-xs text-[var(--color-muted)] space-y-1">
      {showCount && (
        <div>
          {approxMatchCount === 1
            ? "1 existing transaction would have matched."
            : `${approxMatchCount} existing transactions would have matched.`}
        </div>
      )}
      {reasoning && <div className="italic">{reasoning}</div>}
    </div>
  );
}
