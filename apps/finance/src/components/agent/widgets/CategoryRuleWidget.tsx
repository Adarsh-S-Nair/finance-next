"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiX, FiTag, FiZap } from "react-icons/fi";
import { Button } from "@zervo/ui";
import DynamicIcon from "../../DynamicIcon";
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

function categoryColor(cat: Category | null | undefined): string {
  if (!cat) return "#71717a";
  return cat.hex_color || cat.group_color || "#71717a";
}

/**
 * Pretty-print a single rule condition. Mirrors how the user would
 * read it in plain English, not as a code expression. The conditions
 * are validated to a safe set of fields/operators before they ever
 * reach this component.
 */
function formatCondition(c: RuleCondition): { lhs: string; rhs: string } {
  const fieldLabel: Record<string, string> = {
    merchant_name: "merchant",
    description: "description",
    amount: "amount",
  };
  const opLabel: Record<string, string> = {
    is: "is",
    equals: "equals",
    contains: "contains",
    starts_with: "starts with",
    is_greater_than: "is greater than",
    is_less_than: "is less than",
  };
  const lhs = `${fieldLabel[c.field] ?? c.field} ${opLabel[c.operator] ?? c.operator}`;
  const rhs = String(c.value);
  return { lhs, rhs };
}

export default function CategoryRuleWidget({
  toolUseId,
  data,
}: {
  toolUseId: string;
  data: CategoryRuleData;
}) {
  const [state, setState] = useState<WidgetState>({ kind: "checking" });

  // Mount-time check: did the user already accept/decline this rule
  // proposal in a previous session? Same widget-actions table the
  // recategorization widget uses.
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
      // Step 1: create the rule via the existing upsert_category_rule
      // RPC — same path the transactions page takes for UI-created rules.
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
      // Step 2: persist the widget action so reload shows accepted.
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
// Proposal — WHEN ... SET ... + accept/decline
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
      className="space-y-5"
    >
      <RuleHeader />

      <div className="space-y-2.5 pl-12">
        {data.conditions.map((c, i) => {
          const { lhs, rhs } = formatCondition(c);
          return (
            <RuleConditionLine
              key={i}
              label={i === 0 ? "When" : "And"}
              lhs={lhs}
              rhs={rhs}
            />
          );
        })}

        {/* SET row sits inline with the buttons on md+, mirroring the
            recategorization widget's TO row. Mobile stacks. */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4 pt-1">
          <div className="min-w-0 md:flex-1">
            <RuleSetLine label="Set" cat={data.category} />
          </div>
          <div className="flex items-center justify-end gap-2 flex-shrink-0">
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
              Accept
            </Button>
          </div>
        </div>
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
      className="space-y-5"
    >
      <RuleHeader />

      <div className="pl-12">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 md:flex-1">
            <RuleSetLine
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
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────────────

function RuleHeader() {
  // Tiny title row signaling "this is a rule, not a one-time fix" so
  // the user can tell the widget apart from the recategorization one
  // without reading the whole thing.
  return (
    <div className="flex items-center gap-2 text-[var(--color-fg)]">
      <FiZap className="h-3.5 w-3.5 text-[var(--color-muted)]" strokeWidth={2.5} />
      <span className="text-sm font-medium">Auto-categorize future matches</span>
    </div>
  );
}

function RuleConditionLine({
  label,
  lhs,
  rhs,
}: {
  label: string;
  lhs: string;
  rhs: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] w-12 flex-shrink-0">
        {label}
      </span>
      <span className="text-[var(--color-fg)] truncate">
        <span className="text-[var(--color-muted)]">{lhs}</span>{" "}
        <span className="font-medium">&ldquo;{rhs}&rdquo;</span>
      </span>
    </div>
  );
}

function RuleSetLine({
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
          className="w-3.5 h-3.5 rounded-full flex-shrink-0 inline-flex items-center justify-center"
          style={{ backgroundColor: categoryColor(cat) }}
        >
          {/* Tiny icon visible on the colored dot for the SET line — gives
              the rule's target some character without falling back to a
              big chip. */}
          <DynamicIcon
            iconLib={cat.icon_lib}
            iconName={cat.icon_name}
            className="h-2 w-2 text-white"
            fallback={FiTag}
            style={{ strokeWidth: 2.5 }}
          />
        </span>
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
