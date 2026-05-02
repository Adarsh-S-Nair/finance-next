"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiCheck, FiX, FiDollarSign } from "react-icons/fi";
import { Button } from "@zervo/ui";
import { formatCurrency } from "../../../lib/formatCurrency";
import { authFetch } from "../../../lib/api/fetch";
import { WidgetError, WidgetFrame } from "./primitives";

export type IncomeProposalData =
  | {
      action: "set" | "update";
      current_amount: number | null;
      amount: number;
      reasoning: string | null;
      error?: string;
    }
  | {
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

/**
 * Confirmation widget for setting / updating the user's monthly income.
 * Same minimal style + persistence pattern as BudgetProposalWidget.
 *
 * - "set" action (income wasn't set before): shows just the proposed
 *   amount with accept/decline.
 * - "update" action: shows OLD → NEW.
 *
 * Accept → POST /api/agent/user-profile { monthly_income } — lands on
 * user_profiles.monthly_income, visible to the agent in future
 * conversations and to the existing budgets page UI.
 */
export default function IncomeProposalWidget({
  toolUseId,
  data,
}: {
  toolUseId: string;
  data: IncomeProposalData;
}) {
  const [state, setState] = useState<WidgetState>({ kind: "checking" });

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
        // Fall through.
      }
      if (!cancelled) setState({ kind: "idle" });
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [toolUseId, data.error]);

  if (data.error) return <WidgetError message={data.error} />;
  if (!data.action) return <WidgetError message="Invalid income proposal" />;

  async function handleAccept() {
    if (!data.action) return;
    setState({ kind: "committing" });
    try {
      const res = await authFetch("/api/agent/user-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monthly_income: data.amount }),
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
// Proposal
// ──────────────────────────────────────────────────────────────────────────

function ProposalState({
  data,
  committing,
  error,
  onAccept,
  onDecline,
}: {
  data: Exclude<IncomeProposalData, { action?: undefined }>;
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
      <IncomeHeader action={data.action} />

      <div className="pl-14 space-y-2.5">
        {data.action === "update" && data.current_amount !== null ? (
          <ChangeLine
            label="From"
            value={`${formatCurrency(data.current_amount)}/month`}
            muted
          />
        ) : null}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 md:flex-1">
            <ChangeLine
              label={data.action === "update" ? "To" : "Set to"}
              value={`${formatCurrency(data.amount)}/month`}
            />
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
// Resolved
// ──────────────────────────────────────────────────────────────────────────

function ResolvedState({
  tone,
  data,
  silent,
}: {
  tone: "accepted" | "declined";
  data: Exclude<IncomeProposalData, { action?: undefined }>;
  silent: boolean;
}) {
  const label =
    tone === "accepted"
      ? data.action === "update"
        ? "Income updated"
        : "Income set"
      : "Proposal declined";
  return (
    <motion.div
      initial={silent ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="space-y-5"
    >
      <IncomeHeader action={data.action} />

      <div className="pl-14">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="min-w-0 md:flex-1">
            <ChangeLine
              label={tone === "accepted" ? "Now" : "Proposed"}
              value={`${formatCurrency(data.amount)}/month`}
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
            {label}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Bits
// ──────────────────────────────────────────────────────────────────────────

function IncomeHeader({ action }: { action: "set" | "update" }) {
  const subtitle =
    action === "update" ? "Update monthly income" : "Set monthly income";
  return (
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[var(--color-surface-alt)]">
        <FiDollarSign
          className="h-5 w-5 text-[var(--color-fg)]"
          strokeWidth={2.5}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] text-[var(--color-fg)] truncate font-medium">
          Monthly income
        </div>
        <div className="text-[12px] text-[var(--color-muted)] mt-0.5">
          {subtitle}
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
