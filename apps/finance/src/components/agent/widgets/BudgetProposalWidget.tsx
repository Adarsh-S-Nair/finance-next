"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiX, FiTag } from "react-icons/fi";
import { Button } from "@zervo/ui";
import DynamicIcon from "../../DynamicIcon";
import { formatCurrency } from "../../../lib/formatCurrency";
import { authFetch } from "../../../lib/api/fetch";
import { WidgetError, WidgetFrame } from "./primitives";

type BudgetTarget = {
  id: string;
  label: string;
  hex_color: string;
  group_name: string | null;
  group_color: string | null;
  icon_lib: string | null;
  icon_name: string | null;
  scope: "group" | "category";
};

export type BudgetProposalData =
  | {
      action: "create";
      target: BudgetTarget;
      amount: number;
      reasoning: string | null;
      error?: string;
    }
  | {
      action: "update";
      budget_id: string;
      target: BudgetTarget;
      current_amount: number;
      amount: number;
      reasoning: string | null;
      error?: string;
    }
  | {
      action: "delete";
      budget_id: string;
      target: BudgetTarget;
      current_amount: number;
      reasoning: string | null;
      error?: string;
    }
  | {
      // Plain error shape from the tool (no action set yet).
      action?: undefined;
      error: string;
    };

type WidgetState =
  | { kind: "checking" }
  | { kind: "idle" }
  | { kind: "committing" }
  | { kind: "accepted"; silent: boolean }
  | { kind: "declined"; silent: boolean }
  | { kind: "failed"; message: string };

function categoryColor(t: BudgetTarget): string {
  return t.hex_color || t.group_color || "#71717a";
}

export default function BudgetProposalWidget({
  toolUseId,
  data,
}: {
  toolUseId: string;
  data: BudgetProposalData;
}) {
  const [state, setState] = useState<WidgetState>({ kind: "checking" });

  // Mount-time check against the shared user_agent_widget_actions table,
  // same persistence pattern used by recategorization and rule widgets.
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
  if (!data.action) {
    // Defensive — shouldn't hit this; the union ensures action is set
    // unless error is set, and we returned above on error.
    return <WidgetError message="Invalid budget proposal" />;
  }

  async function handleAccept() {
    if (!data.action) return;
    setState({ kind: "committing" });
    try {
      const requestBody =
        data.action === "create"
          ? {
              action: "create",
              category_id: data.target.scope === "category" ? data.target.id : null,
              category_group_id: data.target.scope === "group" ? data.target.id : null,
              amount: data.amount,
            }
          : data.action === "update"
            ? {
                action: "update",
                budget_id: data.budget_id,
                amount: data.amount,
              }
            : {
                action: "delete",
                budget_id: data.budget_id,
              };

      const res = await authFetch("/api/agent/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
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
// Proposal — three layouts share a header + buttons row, body differs
// per action.
// ──────────────────────────────────────────────────────────────────────────

function ProposalState({
  data,
  committing,
  error,
  onAccept,
  onDecline,
}: {
  data: Exclude<BudgetProposalData, { action?: undefined }>;
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
      <BudgetHeader target={data.target} action={data.action} />

      {/* Body depends on action: create shows "Amount $X", update shows
          FROM → TO, delete shows the existing amount being removed.
          Last row inlines accept/decline on md+ to mirror the
          recategorization widget rhythm. */}
      <div className="pl-14 space-y-2.5">
        {data.action === "update" ? (
          <ChangeLine
            label="From"
            value={formatCurrency(data.current_amount)}
            muted
          />
        ) : data.action === "delete" ? (
          <ChangeLine
            label="Amount"
            value={`${formatCurrency(data.current_amount)}/month`}
            muted
          />
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 md:flex-1">
            {data.action === "create" ? (
              <ChangeLine
                label="Amount"
                value={`${formatCurrency(data.amount)}/month`}
              />
            ) : data.action === "update" ? (
              <ChangeLine
                label="To"
                value={`${formatCurrency(data.amount)}/month`}
              />
            ) : (
              <ChangeLine label="Action" value="Remove this budget" />
            )}
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
  data: Exclude<BudgetProposalData, { action?: undefined }>;
  silent: boolean;
}) {
  const verbAccepted: Record<NonNullable<BudgetProposalData["action"]>, string> = {
    create: "Budget created",
    update: "Budget updated",
    delete: "Budget removed",
  };
  return (
    <motion.div
      initial={silent ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <BudgetHeader target={data.target} action={data.action} />

      <div className="pl-14">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 md:flex-1">
            {/* Show the FINAL state of the budget on accept; the
                proposed state on decline-but-muted so the user can see
                what they passed on. */}
            {data.action === "delete" ? (
              <ChangeLine
                label={tone === "accepted" ? "Removed" : "Amount"}
                value={`${formatCurrency(data.current_amount)}/month`}
                muted
              />
            ) : (
              <ChangeLine
                label={tone === "accepted" ? "Now" : "Proposed"}
                value={`${formatCurrency(data.amount)}/month`}
                muted={tone === "declined"}
              />
            )}
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
            {tone === "accepted"
              ? verbAccepted[data.action]
              : "Proposal declined"}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────────────

/**
 * Header reads as "this is a budget proposal for X". Mirrors the
 * recategorization widget's TransactionHeader: 10×10 icon + name +
 * a quiet subtitle that signals the action.
 */
function BudgetHeader({
  target,
  action,
}: {
  target: BudgetTarget;
  action: NonNullable<BudgetProposalData["action"]>;
}) {
  const subtitle: Record<typeof action, string> = {
    create: "New monthly budget",
    update: "Update monthly budget",
    delete: "Remove budget",
  };
  const color = categoryColor(target);
  return (
    <div className="flex items-start gap-4">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <DynamicIcon
          iconLib={target.icon_lib}
          iconName={target.icon_name}
          className="h-5 w-5 text-white"
          fallback={FiTag}
          style={{ strokeWidth: 2.5 }}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] text-[var(--color-fg)] truncate font-medium">
          {target.label}
        </div>
        <div className="text-[12px] text-[var(--color-muted)] mt-0.5">
          {subtitle[action]}
        </div>
      </div>
    </div>
  );
}

function ChangeLine({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-muted)] w-16 flex-shrink-0">
        {label}
      </span>
      <span
        className={`tabular-nums truncate ${
          muted ? "text-[var(--color-muted)]" : "text-[var(--color-fg)]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
