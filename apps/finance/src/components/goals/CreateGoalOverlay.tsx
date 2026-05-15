"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX } from "react-icons/fi";
import { LuPlus, LuTrash2 } from "react-icons/lu";
import { Button } from "@zervo/ui";
import { useUser } from "../providers/UserProvider";
import { useAuthedQuery } from "../../lib/api/useAuthedQuery";
import { formatCurrency } from "../../lib/formatCurrency";
import {
  type Goal,
  type GoalKind,
  type GoalLineItem,
  nextGoalColor,
} from "./types";

type DraftLineItem = { id: string; name: string; target: string };

type SpendingMonth = {
  earning?: number | string;
  spending?: number | string;
  isComplete?: boolean;
  monthName?: string;
  year?: number;
  formattedMonth?: string;
  [key: string]: unknown;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (goal: Goal) => void;
  existingGoals: Goal[];
  editGoal?: Goal | null;
  emergencyFundMode?: boolean;
};

export default function CreateGoalOverlay({
  isOpen,
  onClose,
  onSave,
  existingGoals,
  editGoal = null,
  emergencyFundMode = false,
}: Props) {
  const { user } = useUser();
  const isEdit = !!editGoal;
  const isEmergency = emergencyFundMode || editGoal?.kind === "emergency_fund";

  // Pull real spending data so the emergency-fund suggestion is grounded
  // in the user's actual numbers, not a hardcoded placeholder.
  const { data: spendingPayload } = useAuthedQuery<{ data?: SpendingMonth[] }>(
    ["goals:spending-baseline", user?.id],
    isOpen && isEmergency && !isEdit && user?.id
      ? "/api/transactions/spending-earning?months=6"
      : null,
  );

  // Anchor the suggestion to the most recent 3 complete months — that's
  // the window we display in the breakdown, so the math the user sees
  // matches the number we show. Fall back to all available months if
  // fewer than 3 are complete.
  const { avgMonthlySpend, sampleMonths } = useMemo(() => {
    const months = spendingPayload?.data ?? [];
    if (months.length === 0) return { avgMonthlySpend: null, sampleMonths: [] };
    const completed = months.filter((m) => m.isComplete);
    const sample = completed.length > 0 ? completed : months;
    const nonZero = sample.filter((m) => Number(m.spending || 0) > 0);
    const source = nonZero.length > 0 ? nonZero : sample;
    if (source.length === 0) return { avgMonthlySpend: null, sampleMonths: [] };
    const recent = source.slice(-3);
    const total = recent.reduce((sum, m) => sum + Number(m.spending || 0), 0);
    return {
      avgMonthlySpend: total / recent.length,
      sampleMonths: recent,
    };
  }, [spendingPayload]);

  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([]);
  const [efMultiplier, setEfMultiplier] = useState(3);
  const [userOverrodeTarget, setUserOverrodeTarget] = useState(false);

  // Reset state when (re)opening, or when switching between modes.
  useEffect(() => {
    if (!isOpen) return;
    if (editGoal) {
      setName(editGoal.name);
      setTarget(String(editGoal.target));
      setTargetDate(editGoal.targetDate ?? "");
      setLineItems(
        editGoal.lineItems.map((li) => ({
          id: li.id,
          name: li.name,
          target: String(li.target),
        })),
      );
      setUserOverrodeTarget(false);
    } else if (emergencyFundMode) {
      setName("Emergency Fund");
      setTarget("");
      setTargetDate("");
      setLineItems([]);
      setEfMultiplier(3);
      setUserOverrodeTarget(false);
    } else {
      setName("");
      setTarget("");
      setTargetDate("");
      setLineItems([]);
      setUserOverrodeTarget(false);
    }
  }, [isOpen, editGoal, emergencyFundMode]);

  // Keep the suggested target in sync with the multiplier and the real
  // spending number, but only until the user manually edits the field.
  useEffect(() => {
    if (!isOpen || !emergencyFundMode || isEdit || userOverrodeTarget) return;
    if (avgMonthlySpend == null) return;
    setTarget(String(Math.round(avgMonthlySpend * efMultiplier)));
  }, [efMultiplier, avgMonthlySpend, isOpen, emergencyFundMode, isEdit, userOverrodeTarget]);

  // Esc to close.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const handleAddLineItem = () => {
    setLineItems((items) => [
      ...items,
      { id: `draft_${Date.now()}_${items.length}`, name: "", target: "" },
    ]);
  };

  const handleUpdateLineItem = (
    id: string,
    patch: Partial<Pick<DraftLineItem, "name" | "target">>,
  ) => {
    setLineItems((items) =>
      items.map((li) => (li.id === id ? { ...li, ...patch } : li)),
    );
  };

  const handleRemoveLineItem = (id: string) => {
    setLineItems((items) => items.filter((li) => li.id !== id));
  };

  const targetNum = Number(target || 0);
  const lineItemsSum = lineItems.reduce(
    (sum, li) => sum + Number(li.target || 0),
    0,
  );
  const lineItemDelta = lineItemsSum - targetNum;
  const showLineItemNote = lineItems.length > 0 && Math.abs(lineItemDelta) >= 1;

  const canSave =
    name.trim().length > 0 &&
    targetNum > 0 &&
    lineItems.every((li) => li.name.trim() && Number(li.target) > 0);

  const handleSave = () => {
    if (!canSave) return;
    const kind: GoalKind = isEmergency ? "emergency_fund" : "custom";
    const finalLineItems: GoalLineItem[] = lineItems.map((li) => ({
      id: li.id,
      name: li.name.trim(),
      target: Number(li.target),
    }));

    if (isEdit && editGoal) {
      onSave({
        ...editGoal,
        name: name.trim(),
        target: targetNum,
        targetDate: targetDate || undefined,
        lineItems: finalLineItems,
      });
    } else {
      const maxPriority = existingGoals.reduce(
        (m, g) => (g.status === "active" ? Math.max(m, g.priority) : m),
        -1,
      );
      onSave({
        id: `g_${Date.now()}`,
        name: name.trim(),
        kind,
        target: targetNum,
        targetDate: targetDate || undefined,
        priority: isEmergency ? -1 : maxPriority + 1,
        status: "active",
        isProtected: isEmergency,
        color: isEmergency ? "#64748b" : nextGoalColor(existingGoals),
        lineItems: finalLineItems,
      });
    }
    onClose();
  };

  if (typeof document === "undefined") return null;

  const title = isEdit
    ? "Edit goal"
    : isEmergency
      ? "Your emergency fund"
      : "New savings goal";

  const subtitle = isEdit
    ? null
    : isEmergency
      ? "A protected goal that fills before any other. Your other goals can't pull from it until this one is full."
      : "Save toward something specific — a trip, a purchase, anything with a number attached.";

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="create-goal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-[var(--color-content-bg)] overflow-y-auto"
        >
          <button
            type="button"
            onClick={onClose}
            className="fixed top-5 right-5 md:top-6 md:right-6 z-10 p-2 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>

          <div className="min-h-screen flex items-center justify-center px-6 py-20">
            <div className="w-full max-w-md">
              <motion.h1
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]"
              >
                {title}
              </motion.h1>

              {subtitle && (
                <motion.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed"
                >
                  {subtitle}
                </motion.p>
              )}

              {/* Emergency-fund suggestion driven by real spending data */}
              {isEmergency && !isEdit && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.13 }}
                  className="mt-10"
                >
                  <EmergencyFundSuggestion
                    avgMonthlySpend={avgMonthlySpend}
                    sampleMonths={sampleMonths}
                    multiplier={efMultiplier}
                    onChange={setEfMultiplier}
                  />
                </motion.div>
              )}

              {/* Name field */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="mt-10"
              >
                <SectionLabel>Name</SectionLabel>
                {isEmergency && !isEdit ? (
                  <LockedField value={name} />
                ) : (
                  <UnderlineInput
                    value={name}
                    onChange={setName}
                    placeholder={
                      isEmergency ? "Emergency Fund" : "e.g. European Trip"
                    }
                    autoFocus={!isEmergency}
                  />
                )}
              </motion.div>

              {/* Target amount — bareword style */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mt-8"
              >
                <SectionLabel className="mb-1">Target</SectionLabel>
                <AmountInput
                  value={target}
                  onChange={(v) => {
                    setTarget(v);
                    if (isEmergency && !isEdit) setUserOverrodeTarget(true);
                  }}
                  autoFocus={isEmergency && !isEdit}
                />
              </motion.div>

              {/* Target date — only for custom goals */}
              {!isEmergency && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.26 }}
                  className="mt-8"
                >
                  <SectionLabel>Target date (optional)</SectionLabel>
                  <UnderlineInput
                    type="date"
                    value={targetDate}
                    onChange={setTargetDate}
                  />
                </motion.div>
              )}

              {/* Line items — only for custom goals */}
              {!isEmergency && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8"
                >
                  <div className="flex items-center justify-between mb-3">
                    <SectionLabel>Line items (optional)</SectionLabel>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
                    >
                      <LuPlus size={12} />
                      Add item
                    </button>
                  </div>
                  {lineItems.length === 0 ? (
                    <p className="text-xs text-[var(--color-muted)] leading-relaxed">
                      Break this goal into pieces — e.g. Flights, Hotel, Food.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {lineItems.map((li) => (
                        <div key={li.id} className="flex items-center gap-3">
                          <div className="flex-1">
                            <UnderlineInput
                              value={li.name}
                              onChange={(v) =>
                                handleUpdateLineItem(li.id, { name: v })
                              }
                              placeholder="Item name"
                              size="sm"
                            />
                          </div>
                          <div className="w-28">
                            <UnderlineInput
                              value={li.target}
                              onChange={(v) =>
                                handleUpdateLineItem(li.id, { target: v })
                              }
                              placeholder="0"
                              size="sm"
                              type="number"
                              prefix="$"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(li.id)}
                            aria-label="Remove item"
                            className="p-1.5 text-[var(--color-muted)] hover:text-[var(--color-danger)] transition-colors"
                          >
                            <LuTrash2 size={14} />
                          </button>
                        </div>
                      ))}
                      {showLineItemNote && (
                        <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-1">
                          Items sum to {formatCurrency(lineItemsSum)} ·{" "}
                          {lineItemDelta > 0
                            ? `${formatCurrency(lineItemDelta)} over target`
                            : `${formatCurrency(Math.abs(lineItemDelta))} buffer remaining`}
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Submit */}
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.34 }}
                className="mt-10"
              >
                <Button
                  onClick={handleSave}
                  disabled={!canSave}
                  className="w-full h-11"
                >
                  {isEdit
                    ? "Save changes"
                    : isEmergency
                      ? "Set up emergency fund"
                      : "Create goal"}
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ─── Sub-components ───────────────────────────────────────────────────

function SectionLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)] mb-3 ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Underline-style text input — matches the bare, low-chrome inputs used
 * elsewhere in the app (e.g. IncomeEditor). Focus reveals a fg-colored
 * underline. Use this for name, date, and any free-text fields.
 */
function UnderlineInput({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  type = "text",
  size = "md",
  prefix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  type?: string;
  size?: "sm" | "md";
  prefix?: string;
}) {
  const sizeClass =
    size === "sm" ? "text-sm py-1.5" : "text-base py-2";
  return (
    <div className="flex items-baseline gap-1.5">
      {prefix && (
        <span className={`${sizeClass} text-[var(--color-muted)]`}>
          {prefix}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        inputMode={type === "number" ? "decimal" : undefined}
        className={`w-full bg-transparent border-b border-[var(--color-border)] focus:border-[var(--color-fg)] outline-none text-[var(--color-fg)] placeholder:text-[var(--color-muted)]/60 transition-colors ${sizeClass} ${type === "number" ? "tabular-nums" : ""}`}
      />
    </div>
  );
}

/**
 * Bareword amount input — borrowed from the budgets AmountStep. Large,
 * borderless, with a leading $ sign. Used for the goal's target amount.
 */
function AmountInput({
  value,
  onChange,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const inputId = "goal-target-input";
  return (
    <div
      className="flex items-baseline gap-1 cursor-text"
      onClick={() => document.getElementById(inputId)?.focus()}
    >
      <span className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)]">
        $
      </span>
      <input
        id={inputId}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        placeholder="0"
        className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] tabular-nums bg-transparent border-none outline-none p-0 m-0 focus:ring-0 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none placeholder:text-[var(--color-muted)]/40"
        style={{
          width: `${Math.max((value?.toString().length || 1) * 0.65 + 0.3, 2)}em`,
        }}
      />
    </div>
  );
}

/**
 * Read-only field that mirrors a standard input visually but is clearly
 * non-editable: muted background, no focus state, default cursor.
 */
function LockedField({ value }: { value: string }) {
  return (
    <div
      aria-disabled="true"
      className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2 text-base text-[var(--color-fg)]/70 cursor-default select-none"
    >
      {value}
    </div>
  );
}

function EmergencyFundSuggestion({
  avgMonthlySpend,
  sampleMonths,
  multiplier,
  onChange,
}: {
  avgMonthlySpend: number | null;
  sampleMonths: SpendingMonth[];
  multiplier: number;
  onChange: (n: number) => void;
}) {
  const suggested =
    avgMonthlySpend != null ? avgMonthlySpend * multiplier : null;

  if (avgMonthlySpend == null) {
    return (
      <div>
        <SectionLabel className="mb-1">Suggested target</SectionLabel>
        <div className="text-2xl font-medium text-[var(--color-fg)] tabular-nums">
          —
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
          We&apos;ll suggest a target once we&apos;ve analyzed a few months
          of your spending. For now, enter what feels right below.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionLabel className="mb-1">Suggested target</SectionLabel>
      <div className="text-2xl font-medium text-[var(--color-fg)] tabular-nums">
        {formatCurrency(suggested ?? 0)}
      </div>
      <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
        {formatCurrency(avgMonthlySpend)} average monthly spending × {multiplier}{" "}
        {multiplier === 1 ? "month" : "months"} of runway.
      </p>

      {/* Runway slider */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-muted)]">
            Runway
          </span>
          <span className="text-xs text-[var(--color-fg)] tabular-nums">
            {multiplier} {multiplier === 1 ? "month" : "months"}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={12}
          step={1}
          value={multiplier}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full accent-[var(--color-fg)]"
        />
        <div className="flex justify-between text-[10px] text-[var(--color-muted)] mt-0.5">
          <span>1mo</span>
          <span>6mo</span>
          <span>12mo</span>
        </div>
      </div>

      {/* Breakdown of how the average was computed */}
      {sampleMonths.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <SectionLabel className="mb-2">How we got this number</SectionLabel>
          <div className="space-y-1.5">
            {sampleMonths.map((m, i) => (
              <div
                key={`${m.year}-${m.monthName}-${i}`}
                className="flex items-baseline justify-between text-xs"
              >
                <span className="text-[var(--color-muted)]">
                  {m.formattedMonth ?? `${m.monthName} ${m.year}`}
                </span>
                <span className="text-[var(--color-fg)] tabular-nums">
                  {formatCurrency(Number(m.spending || 0))}
                </span>
              </div>
            ))}
            <div className="flex items-baseline justify-between text-xs pt-2 mt-1 border-t border-[var(--color-border)]">
              <span className="text-[var(--color-muted)]">
                Average{" "}
                <span className="text-[var(--color-muted)]/70">
                  · {sampleMonths.length}{" "}
                  {sampleMonths.length === 1 ? "month" : "months"}
                </span>
              </span>
              <span className="text-[var(--color-fg)] font-medium tabular-nums">
                {formatCurrency(avgMonthlySpend)}
              </span>
            </div>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--color-muted)]">
                × {multiplier} {multiplier === 1 ? "month" : "months"} of runway
              </span>
              <span className="text-[var(--color-fg)] font-medium tabular-nums">
                {formatCurrency(suggested ?? 0)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
