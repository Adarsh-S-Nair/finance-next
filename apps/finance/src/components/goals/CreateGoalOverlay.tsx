"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiTag } from "react-icons/fi";
import { LuPlus, LuTrash2, LuInfo } from "react-icons/lu";
import { Button } from "@zervo/ui";
import DynamicIcon from "../DynamicIcon";
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

/**
 * One row from /api/transactions/spending-by-category?groupBy=group.
 * Each entry represents a category group (e.g. "Rent and Utilities")
 * with the user's monthly average spend in that group.
 */
type CategoryGroupSpend = {
  id: string;
  label: string;
  hex_color?: string | null;
  icon_lib?: string | null;
  icon_name?: string | null;
  monthly_avg: number;
  total_spent: number;
  months_with_spending: number;
};

/**
 * Category groups that count as essential monthly obligations for the
 * emergency-fund baseline. Mirrors Plaid's PFC groups for
 * housing/utilities/loans/food/transit/medical. We avoid going more
 * granular than group level here — a user might categorize some
 * restaurants as "Food and Drink" and that's still a recurring need
 * if they lose their income, even if not strictly "essential."
 *
 * General Services covers a wide range (legal, accounting, insurance,
 * etc.) so it's not in the allowlist by default.
 */
const ESSENTIAL_GROUP_NAMES = new Set([
  "Rent and Utilities",
  "Loan Payments",
  "Food and Drink",
  "Medical",
  "Transportation",
]);

function isEssentialGroup(g: CategoryGroupSpend): boolean {
  return ESSENTIAL_GROUP_NAMES.has(g.label);
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

  // Pull the user's spending broken down by category group over the last
  // ~4 complete months. `forBudget=true` anchors to complete-month
  // boundaries and excludes the current month. We deliberately pass
  // `consistent=false` here — the default 2/3-of-months consistency
  // filter is great for budget suggestions but wrong for the
  // emergency-fund baseline. A mortgage paid once in a 4-month window
  // (because earlier months are missing from sync) is still a real
  // monthly obligation; the consistency filter would silently drop
  // the entire Loan Payments group in that case.
  const { data: spendingPayload } = useAuthedQuery<{
    categories?: CategoryGroupSpend[];
  }>(
    ["goals:essentials-baseline", user?.id],
    isOpen && isEmergency && !isEdit && user?.id
      ? "/api/transactions/spending-by-category?groupBy=group&forBudget=true&consistent=false&days=120"
      : null,
  );

  /**
   * Filter to essential groups and sort desc by monthly average. The
   * sum is the monthly-essentials baseline.
   */
  const { essentialGroups, avgMonthlyEssentials } = useMemo(() => {
    const raw = spendingPayload?.categories ?? [];
    const filtered = raw
      .filter((g) => isEssentialGroup(g) && g.monthly_avg > 0)
      .sort((a, b) => b.monthly_avg - a.monthly_avg);
    const total = filtered.reduce((sum, g) => sum + g.monthly_avg, 0);
    return {
      essentialGroups: filtered,
      avgMonthlyEssentials: total > 0 ? total : null,
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

  // Keep the suggested target in sync with the multiplier and the
  // essentials baseline, but only until the user manually edits the field.
  useEffect(() => {
    if (!isOpen || !emergencyFundMode || isEdit || userOverrodeTarget) return;
    if (avgMonthlyEssentials == null) return;
    setTarget(String(Math.round(avgMonthlyEssentials * efMultiplier)));
  }, [efMultiplier, avgMonthlyEssentials, isOpen, emergencyFundMode, isEdit, userOverrodeTarget]);

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
                    avgMonthlyEssentials={avgMonthlyEssentials}
                    essentialGroups={essentialGroups}
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
  avgMonthlyEssentials,
  essentialGroups,
  multiplier,
  onChange,
}: {
  avgMonthlyEssentials: number | null;
  essentialGroups: CategoryGroupSpend[];
  multiplier: number;
  onChange: (n: number) => void;
}) {
  const suggested =
    avgMonthlyEssentials != null ? avgMonthlyEssentials * multiplier : null;

  if (avgMonthlyEssentials == null) {
    return (
      <div>
        <SectionLabel className="mb-1">Suggested target</SectionLabel>
        <div className="text-2xl font-medium text-[var(--color-fg)] tabular-nums">
          —
        </div>
        <p className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
          We&apos;ll suggest a target once we&apos;ve seen a few months of
          your spending in essential categories like rent, utilities, and
          groceries. For now, enter what feels right below.
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
        {formatCurrency(avgMonthlyEssentials)} in monthly essentials ×{" "}
        {multiplier} {multiplier === 1 ? "month" : "months"} of runway.
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

      {/* Breakdown: essential spending by category group */}
      {essentialGroups.length > 0 && (
        <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <SectionLabel className="mb-2">Your essential spending</SectionLabel>
          <p className="text-[11px] text-[var(--color-muted)] leading-relaxed mb-3">
            Average monthly spend in <em>Rent and Utilities</em>,{" "}
            <em>Loan Payments</em>, <em>Food and Drink</em>,{" "}
            <em>Medical</em>, and <em>Transportation</em> over the last few
            complete months.
          </p>
          <div className="space-y-2">
            {essentialGroups.map((g) => (
              <CategoryGroupRow key={g.id} group={g} />
            ))}
          </div>
          <MissingExpenseNote essentialGroups={essentialGroups} />
        </div>
      )}

      {/* Math summary */}
      <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-[var(--color-muted)]">Monthly essentials</span>
          <span className="text-[var(--color-fg)] font-medium tabular-nums">
            {formatCurrency(avgMonthlyEssentials)}
            <span className="text-[var(--color-muted)] font-normal"> /mo</span>
          </span>
        </div>
        <div className="flex items-baseline justify-between text-xs mt-1.5">
          <span className="text-[var(--color-muted)]">
            × {multiplier} {multiplier === 1 ? "month" : "months"} of runway
          </span>
          <span className="text-[var(--color-fg)] font-medium tabular-nums">
            {formatCurrency(suggested ?? 0)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Helper note shown under the essentials breakdown explaining why a big
 * expected bill (mortgage, car loan, etc.) might not appear. Plaid's
 * categorization is imperfect for ACH outflows — mortgage payments
 * frequently land in "Transfer Out" instead of "Loan Payments" and get
 * filtered out as a transfer. The fix is in the user's hands: they can
 * recategorize from the transactions page.
 *
 * If the user IS missing "Loan Payments" specifically, surface a more
 * pointed message — that's the highest-leverage category that's also
 * the most likely to be miscategorized.
 */
function MissingExpenseNote({
  essentialGroups,
}: {
  essentialGroups: CategoryGroupSpend[];
}) {
  const hasLoanPayments = essentialGroups.some(
    (g) => g.label === "Loan Payments",
  );

  return (
    <div className="mt-4 flex items-start gap-2 text-[11px] text-[var(--color-muted)] leading-relaxed">
      <LuInfo size={12} className="mt-0.5 flex-shrink-0" />
      <p>
        {hasLoanPayments ? (
          <>
            Don&apos;t see a bill you expect? It may be categorized
            differently — e.g. as a transfer.{" "}
          </>
        ) : (
          <>
            We didn&apos;t find any spending in <em>Loan Payments</em>. If
            you pay a mortgage or car loan, it&apos;s likely categorized
            as a transfer instead.{" "}
          </>
        )}
        <Link
          href="/transactions"
          className="underline hover:text-[var(--color-fg)]"
        >
          Recategorize in your transactions
        </Link>
        .
      </p>
    </div>
  );
}

function CategoryGroupRow({ group }: { group: CategoryGroupSpend }) {
  const color = group.hex_color || "var(--color-muted)";
  return (
    <div className="flex items-center gap-3 text-xs">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <DynamicIcon
          iconLib={group.icon_lib}
          iconName={group.icon_name}
          className="h-3 w-3 text-white"
          style={{ strokeWidth: 2.5 }}
          fallback={FiTag}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[var(--color-fg)] truncate">{group.label}</div>
      </div>
      <div className="text-[var(--color-fg)] tabular-nums whitespace-nowrap">
        {formatCurrency(group.monthly_avg)}
        <span className="text-[var(--color-muted)]"> /mo</span>
      </div>
    </div>
  );
}
