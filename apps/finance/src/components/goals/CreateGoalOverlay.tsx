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

type RecurringStream = {
  id?: string;
  description?: string | null;
  merchant_name?: string | null;
  frequency?: string | null;
  average_amount?: number | string | null;
  last_amount?: number | string | null;
  stream_type?: string | null;
  status?: string | null;
  icon_url?: string | null;
  category_hex_color?: string | null;
  [key: string]: unknown;
};

/**
 * Convert a recurring stream's amount to a monthly figure based on its
 * frequency. UNKNOWN frequencies are treated as monthly — better to
 * over-count them than to drop them silently.
 */
function streamToMonthly(stream: RecurringStream): number {
  const amt = Math.abs(Number(stream.average_amount ?? stream.last_amount ?? 0));
  if (!amt) return 0;
  switch (stream.frequency) {
    case "WEEKLY":
      return amt * 4.33;
    case "BIWEEKLY":
      return amt * 2.17;
    case "SEMI_MONTHLY":
      return amt * 2;
    case "MONTHLY":
      return amt;
    case "ANNUALLY":
      return amt / 12;
    default:
      return amt;
  }
}

function frequencyLabel(freq: string | null | undefined): string {
  switch (freq) {
    case "WEEKLY":
      return "weekly";
    case "BIWEEKLY":
      return "biweekly";
    case "SEMI_MONTHLY":
      return "twice/mo";
    case "MONTHLY":
      return "monthly";
    case "ANNUALLY":
      return "yearly";
    default:
      return "recurring";
  }
}

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

  // Pull recurring outflows so the emergency-fund suggestion reflects the
  // user's actual fixed obligations — mortgage, subscriptions, etc. —
  // rather than a noisy monthly-total average that can swing wildly when
  // one big one-off purchase lands in a single month.
  const { data: recurringPayload } = useAuthedQuery<{
    recurring?: RecurringStream[];
  }>(
    ["goals:recurring-baseline", user?.id],
    isOpen && isEmergency && !isEdit && user?.id
      ? "/api/recurring/get?streamType=outflow"
      : null,
  );

  /**
   * Convert each recurring outflow stream into a per-month amount and sum
   * them. Streams are sorted desc by monthly cost so the user sees the
   * impactful items first — Mortgage > Netflix.
   */
  const { avgMonthlyRecurring, recurringStreams } = useMemo(() => {
    const raw = recurringPayload?.recurring ?? [];
    const annotated = raw
      .map((s) => ({ stream: s, monthly: streamToMonthly(s) }))
      .filter((s) => s.monthly > 0);
    if (annotated.length === 0) {
      return { avgMonthlyRecurring: null as number | null, recurringStreams: [] };
    }
    annotated.sort((a, b) => b.monthly - a.monthly);
    const total = annotated.reduce((sum, s) => sum + s.monthly, 0);
    return {
      avgMonthlyRecurring: total,
      recurringStreams: annotated,
    };
  }, [recurringPayload]);

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

  // Keep the suggested target in sync with the multiplier and the
  // recurring-obligation baseline, but only until the user manually edits
  // the field.
  useEffect(() => {
    if (!isOpen || !emergencyFundMode || isEdit || userOverrodeTarget) return;
    if (avgMonthlyRecurring == null) return;
    setTarget(String(Math.round(avgMonthlyRecurring * efMultiplier)));
  }, [efMultiplier, avgMonthlyRecurring, isOpen, emergencyFundMode, isEdit, userOverrodeTarget]);

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

              {/* Emergency-fund suggestion driven by recurring obligations */}
              {isEmergency && !isEdit && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.13 }}
                  className="mt-10"
                >
                  <EmergencyFundSuggestion
                    avgMonthlyRecurring={avgMonthlyRecurring}
                    recurringStreams={recurringStreams}
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

type AnnotatedStream = { stream: RecurringStream; monthly: number };

function EmergencyFundSuggestion({
  avgMonthlyRecurring,
  recurringStreams,
  multiplier,
  onChange,
}: {
  avgMonthlyRecurring: number | null;
  recurringStreams: AnnotatedStream[];
  multiplier: number;
  onChange: (n: number) => void;
}) {
  const suggested =
    avgMonthlyRecurring != null ? avgMonthlyRecurring * multiplier : null;

  if (avgMonthlyRecurring == null) {
    return (
      <div>
        <SectionLabel className="mb-1">Suggested target</SectionLabel>
        <div className="text-2xl font-medium text-[var(--color-fg)] tabular-nums">
          —
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
          We&apos;ll suggest a target once we&apos;ve detected your recurring
          bills and subscriptions. For now, enter what feels right below.
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
        {formatCurrency(avgMonthlyRecurring)} in recurring bills × {multiplier}{" "}
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

      {/* Breakdown — list of recurring obligations contributing to the total */}
      {recurringStreams.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <SectionLabel className="mb-2">Your recurring bills</SectionLabel>
          <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mb-3">
            Detected from your transactions. Each amount below is normalized
            to a monthly cost.
          </p>
          <div className="space-y-1.5">
            {recurringStreams.map(({ stream, monthly }, i) => {
              const label =
                stream.merchant_name ||
                stream.description ||
                "Recurring charge";
              const freq = frequencyLabel(stream.frequency);
              const showFreq = stream.frequency && stream.frequency !== "MONTHLY";
              return (
                <div
                  key={stream.id ?? `${label}-${i}`}
                  className="flex items-baseline justify-between gap-3 text-xs"
                >
                  <span className="text-[var(--color-fg)] truncate">
                    {label}
                    {showFreq && (
                      <span className="text-[var(--color-muted)]"> · {freq}</span>
                    )}
                  </span>
                  <span className="text-[var(--color-fg)] tabular-nums whitespace-nowrap">
                    {formatCurrency(monthly)}
                    <span className="text-[var(--color-muted)]"> /mo</span>
                  </span>
                </div>
              );
            })}
            <div className="flex items-baseline justify-between text-xs pt-2 mt-1 border-t border-[var(--color-border)]">
              <span className="text-[var(--color-muted)]">
                Total{" "}
                <span className="text-[var(--color-muted)]/70">
                  · {recurringStreams.length}{" "}
                  {recurringStreams.length === 1 ? "bill" : "bills"}
                </span>
              </span>
              <span className="text-[var(--color-fg)] font-medium tabular-nums">
                {formatCurrency(avgMonthlyRecurring)}
                <span className="text-[var(--color-muted)] font-normal"> /mo</span>
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
