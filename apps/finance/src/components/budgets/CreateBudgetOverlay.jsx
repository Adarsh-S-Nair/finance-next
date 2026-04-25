"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCheck, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { FiTag } from "react-icons/fi";
import DynamicIcon from "../DynamicIcon";
import IncomeBreakdownChart from "./IncomeBreakdownChart";
import { Button } from "@zervo/ui";

export default function CreateBudgetOverlay({
  isOpen,
  onClose,
  onCreated,
  monthlyIncome = 0,
  incomeMonths = [],
  existingBudgets = [],
}) {
  // First-time users always start at the income step. Returning users
  // who already have budgets skip straight to category selection.
  const showIncome = existingBudgets.length === 0;
  const initialStep = showIncome ? "income" : "choose";
  const [step, setStep] = useState(initialStep); // income | choose | amount | done
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [amount, setAmount] = useState("");
  const [spendingHistory, setSpendingHistory] = useState([]);
  const [createdBudgets, setCreatedBudgets] = useState([]);
  const [creating, setCreating] = useState(false);
  const [adjustedIncome, setAdjustedIncome] = useState(
    Math.round(monthlyIncome || 0)
  );

  // Keep adjustedIncome in sync with parent prop (e.g. when data loads).
  useEffect(() => {
    setAdjustedIncome(Math.round(monthlyIncome || 0));
  }, [monthlyIncome]);

  // Reset state after overlay closes (delay for exit animation).
  useEffect(() => {
    if (isOpen) return;
    const t = setTimeout(() => {
      setStep(initialStep);
      setCategories([]);
      setSelectedCategory(null);
      setAmount("");
      setSpendingHistory([]);
      setCreatedBudgets([]);
      setCreating(false);
      setLoading(true);
      setAdjustedIncome(Math.round(monthlyIncome || 0));
    }, 250);
    return () => clearTimeout(t);
  }, [isOpen, initialStep, monthlyIncome]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Buckets already covered by an existing budget. We filter these out of
  // the chip grid so users can't accidentally create a duplicate budget for
  // the same group or category.
  const existingBucketKeys = useMemo(
    () =>
      new Set(
        existingBudgets
          .flatMap((b) => [
            b.category_group_id ? `group:${b.category_group_id}` : null,
            b.category_id ? `category:${b.category_id}` : null,
          ])
          .filter(Boolean)
      ),
    [existingBudgets],
  );

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      // Default to category groups — budgets are about planning, and users
      // think in groups ("food", "transportation") more than granular
      // system categories ("coffee", "fast food"). The API still returns
      // individual system categories if the user later needs them.
      const res = await fetch(
        "/api/transactions/spending-by-category?days=120&forBudget=true&groupBy=group"
      );
      const data = await res.json();

      const cats = (data.categories || [])
        .filter((c) => c.total_spent > 0 && c.label !== "Account Transfer")
        .filter((c) => !existingBucketKeys.has(`group:${c.id}`))
        .sort((a, b) => b.total_spent - a.total_spent)
        .map((c) => ({
          id: c.id,
          type: "group",
          label: c.label,
          monthlyAvg: c.monthly_avg || 0,
          hexColor: c.hex_color || "#6B7280",
          iconName: c.icon_name,
          iconLib: c.icon_lib,
          monthsWithSpending: c.months_with_spending || 0,
        }));

      setCategories(cats);
    } catch (e) {
      console.error("Failed to fetch categories:", e);
    } finally {
      setLoading(false);
    }
  }, [existingBucketKeys]);

  // Fetch categories when opened.
  useEffect(() => {
    if (!isOpen) return;
    fetchCategories();
  }, [isOpen, fetchCategories]);

  async function fetchHistory(bucket) {
    try {
      const param =
        bucket.type === "group"
          ? `categoryGroupId=${bucket.id}`
          : `categoryId=${bucket.id}`;
      const res = await fetch(
        `/api/transactions/category-history?${param}&months=4`
      );
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        setSpendingHistory(
          data.data.map((m) => ({
            month: m.monthName,
            spending: m.spending,
          }))
        );
      } else {
        setSpendingHistory([]);
      }
    } catch {
      setSpendingHistory([]);
    }
  }

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat);
    setAmount(cat.monthlyAvg.toString());
    setSpendingHistory([]);
    setStep("amount");
    fetchHistory(cat);
  };

  const createBudget = async (bucket, budgetAmount) => {
    const payload = {
      amount: parseFloat(budgetAmount),
      period: "monthly",
      // Persist the user's confirmed monthly income so the budgets
      // page doesn't have to recompute it from raw transaction data.
      monthly_income: Math.round(adjustedIncome || 0),
    };
    if (bucket.type === "group") {
      payload.category_group_id = bucket.id;
    } else {
      payload.category_id = bucket.id;
    }
    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create budget");
    return res.json();
  };

  const handleCreateSingle = async () => {
    if (!selectedCategory || !amount) return;
    setCreating(true);
    try {
      await createBudget(selectedCategory, amount);
      setCreatedBudgets([
        {
          label: selectedCategory.label,
          amount: parseFloat(amount),
          hexColor: selectedCategory.hexColor,
          iconName: selectedCategory.iconName,
          iconLib: selectedCategory.iconLib,
        },
      ]);
      onCreated();
      setStep("done");
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateAll = async () => {
    setCreating(true);
    try {
      await Promise.all(
        categories.map((cat) => createBudget(cat, cat.monthlyAvg))
      );
      setCreatedBudgets(
        categories.map((cat) => ({
          label: cat.label,
          amount: cat.monthlyAvg,
          hexColor: cat.hexColor,
          iconName: cat.iconName,
          iconLib: cat.iconLib,
        }))
      );
      onCreated();
      setStep("done");
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="create-budget-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] bg-[var(--color-content-bg)] overflow-y-auto"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="fixed top-5 right-5 md:top-6 md:right-6 z-10 p-2 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>

          {/* Content */}
          <div className="min-h-screen flex items-center justify-center px-6 py-20">
            {/* Side nav chevrons */}
            <StepSideNav
              step={step}
              showIncome={showIncome}
              onNav={(next) => {
                // Leaving amount → clear the in-progress selection so the
                // user can pick a different category cleanly.
                if (step === "amount" && next !== "amount") {
                  setSelectedCategory(null);
                  setAmount("");
                  setSpendingHistory([]);
                }
                setStep(next);
              }}
              selectedCategory={selectedCategory}
            />

            <div className="w-full max-w-md">
              <AnimatePresence mode="wait">
                {step === "income" && (
                  <motion.div
                    key="income"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <IncomeStep
                      monthlyIncome={adjustedIncome}
                      incomeMonths={incomeMonths}
                      onAdjust={setAdjustedIncome}
                    />
                  </motion.div>
                )}

                {step === "choose" && (
                  <motion.div
                    key="choose"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChooseStep
                      categories={categories}
                      loading={loading}
                      onSelect={handleSelectCategory}
                      onCreateAll={handleCreateAll}
                      creating={creating}
                      monthlyIncome={adjustedIncome}
                      existingBudgets={existingBudgets}
                    />
                  </motion.div>
                )}

                {step === "amount" && (
                  <motion.div
                    key="amount"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <AmountStep
                      category={selectedCategory}
                      amount={amount}
                      onAmountChange={setAmount}
                      spendingHistory={spendingHistory}
                      onCreate={handleCreateSingle}
                      creating={creating}
                      monthlyIncome={adjustedIncome}
                      existingBudgets={existingBudgets}
                    />
                  </motion.div>
                )}

                {step === "done" && (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DoneStep
                      budgets={createdBudgets}
                      onClose={onClose}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom progress bars */}
              <StepProgress current={step} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ── Shared primitives ────────────────────────────────────── */

const STEP_ORDER = ["income", "choose", "amount"];

function StepProgress({ current }) {
  const idx = STEP_ORDER.indexOf(current);
  if (idx === -1) return null;
  return (
    <div className="flex items-center gap-1 mt-12">
      {STEP_ORDER.map((s, i) => (
        <div
          key={s}
          className={`h-[3px] rounded-full transition-all duration-500 ${
            i === idx
              ? "flex-[2] bg-[var(--color-fg)]"
              : i < idx
                ? "flex-1 bg-[var(--color-fg)] opacity-30"
                : "flex-1 bg-[var(--color-border)]"
          }`}
        />
      ))}
    </div>
  );
}

function StepSideNav({ step, showIncome, onNav, selectedCategory }) {
  const idx = STEP_ORDER.indexOf(step);
  if (idx === -1) return null;

  const canGoBack = idx > 0 && (showIncome || idx > 0);
  // Can only go forward from income → choose (choose → amount requires
  // selecting a category, so that's handled by the step itself).
  const canGoForward = step === "income" || (step === "choose" && selectedCategory);

  const goPrev = () => {
    if (!canGoBack) return;
    onNav(STEP_ORDER[idx - 1]);
  };

  const goNext = () => {
    if (!canGoForward) return;
    onNav(STEP_ORDER[idx + 1]);
  };

  return (
    <>
      {/* Left chevron */}
      <button
        type="button"
        onClick={goPrev}
        disabled={!canGoBack}
        className="fixed left-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
        aria-label="Previous step"
      >
        <FiChevronLeft className="h-5 w-5" />
      </button>

      {/* Right chevron */}
      <button
        type="button"
        onClick={goNext}
        disabled={!canGoForward}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-10 w-9 h-9 flex items-center justify-center rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] transition-colors cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
        aria-label="Next step"
      >
        <FiChevronRight className="h-5 w-5" />
      </button>
    </>
  );
}

function SectionLabel({ children, className = "" }) {
  return (
    <div
      className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-muted)] ${className}`}
    >
      {children}
    </div>
  );
}

function CategoryDot({ hexColor, iconName, iconLib, size = 36 }) {
  const dim = `${size}px`;
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: dim, height: dim, backgroundColor: hexColor }}
    >
      <DynamicIcon
        iconLib={iconLib}
        iconName={iconName}
        className="text-white"
        style={{ width: `${size * 0.4}px`, height: `${size * 0.4}px` }}
        fallback={FiTag}
      />
    </div>
  );
}

/* ── Animated counter (easeOutCubic RAF interpolation) ───── */

function AnimatedCurrency({ value, duration = 300 }) {
  const [display, setDisplay] = useState(value);
  const animRef = useRef(null);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current === value) return;
    const start = prevRef.current;
    const end = value;
    prevRef.current = value;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.round(start + (end - start) * ease));
      if (progress < 1) {
        animRef.current = requestAnimationFrame(tick);
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value, duration]);

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(display);

  return <>{formatted}</>;
}

/* ── Monthly outlook (income breakdown preview) ───────────── */

function MonthlyOutlook({
  income,
  existingBudgets = [],
  newCategories = [],
  newAllocationOverride = null,
}) {
  const existingTotal = existingBudgets.reduce(
    (sum, b) => sum + Number(b.amount || 0),
    0
  );
  const newTotal =
    newAllocationOverride != null
      ? newAllocationOverride
      : newCategories.reduce(
          (sum, c) => sum + Number(c.monthlyAvg || 0),
          0
        );
  const totalAllocated = existingTotal + newTotal;
  const remaining = Math.max(0, income - totalAllocated);
  const overAllocated = Math.max(0, totalAllocated - income);
  const barTotal = Math.max(income, totalAllocated, 1);

  // Existing budgets show in their own colors at full saturation.
  const existingSegments = existingBudgets
    .map((b) => {
      const amt = Number(b.amount || 0);
      if (amt <= 0) return null;
      const isGroup = !!b.category_groups;
      const color =
        (isGroup ? b.category_groups?.hex_color : b.system_categories?.hex_color) ||
        "var(--color-muted)";
      const label = isGroup
        ? b.category_groups?.name
        : b.system_categories?.label || "Existing budget";
      return { id: `existing-${b.id}`, amount: amt, color, label, isNew: false };
    })
    .filter(Boolean);

  // In-progress new segments get a subtle pulse/border so they stand out
  // from already-saved budgets without being tonally different.
  const newSegments = newCategories
    .map((c) => {
      const amt = Number(c.monthlyAvg || 0);
      if (amt <= 0) return null;
      return {
        id: `new-${c.id}`,
        amount: amt,
        color: c.hexColor || "var(--color-muted)",
        label: c.label,
        isNew: true,
      };
    })
    .filter(Boolean);

  const segments = [...existingSegments, ...newSegments];
  const pctOfIncome = income > 0 ? Math.round((totalAllocated / income) * 100) : 0;
  const rightValue = overAllocated > 0 ? overAllocated : remaining;

  return (
    <div>
      <SectionLabel className="mb-3">Monthly outlook</SectionLabel>

      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[22px] font-medium text-[var(--color-fg)] tabular-nums leading-tight">
            <AnimatedCurrency value={Math.round(income)} />
          </div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
            average income
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-[22px] font-medium tabular-nums leading-tight transition-colors duration-200"
            style={{
              color: overAllocated > 0 ? "var(--color-danger)" : "var(--color-fg)",
            }}
          >
            <AnimatedCurrency value={Math.round(rightValue)} />
          </div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
            {overAllocated > 0 ? "over income" : "free to save"}
          </div>
        </div>
      </div>

      <div className="h-2 w-full rounded-full overflow-hidden bg-[var(--color-border)] flex">
        {segments.map((seg) => {
          const pct = barTotal > 0 ? (seg.amount / barTotal) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <motion.div
              key={seg.id}
              className="h-full"
              initial={false}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 220, damping: 30 }}
              style={{
                backgroundColor: seg.color,
              }}
              title={`${seg.label} · $${Math.round(seg.amount).toLocaleString()}`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 text-[11px] text-[var(--color-muted)]">
        <span className="tabular-nums">
          <AnimatedCurrency value={Math.round(totalAllocated)} /> budgeted
        </span>
        <span className="tabular-nums">{pctOfIncome}% of income</span>
      </div>
    </div>
  );
}

/* ── Step: Confirm monthly income ────────────────────────── */

function IncomeStep({ monthlyIncome, incomeMonths, onAdjust }) {
  const hasZeroMonth = incomeMonths.some(
    (m) => Number(m.earning || 0) === 0
  );

  const isLoading = incomeMonths.length === 0;

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]"
      >
        Your monthly income
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-sm text-[var(--color-muted)] mt-2 leading-relaxed"
      >
        We&apos;ll size your budgets against this number.
      </motion.p>

      {/* Average + chart on same row, vertically centered */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-10"
      >
        {isLoading ? (
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="h-3 w-28 bg-[var(--color-border)] rounded animate-pulse" />
              <div className="h-8 w-36 bg-[var(--color-border)] rounded animate-pulse mt-2" />
            </div>
            <div className="flex items-end gap-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col items-center gap-1.5">
                  <div className="h-3 w-8 bg-[var(--color-border)] rounded animate-pulse" />
                  <div
                    className="w-6 bg-[var(--color-border)] rounded-sm animate-pulse"
                    style={{ height: `${12 + i * 12}px` }}
                  />
                  <div className="h-3 w-5 bg-[var(--color-border)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-6">
            <div>
              <SectionLabel className="mb-1">Estimated average</SectionLabel>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] tabular-nums">
                  <AnimatedCurrency value={monthlyIncome} />
                </span>
                <span className="text-sm text-[var(--color-muted)] ml-1">/ mo</span>
              </div>
            </div>

            <IncomeBreakdownChart
              months={incomeMonths}
              onAverageChange={onAdjust}
              compact
            />
          </div>
        )}
      </motion.div>

      {/* $0 month disclaimer */}
      {hasZeroMonth && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-xs text-[var(--color-muted)] mt-8 leading-relaxed"
        >
          A $0 month usually means an account wasn&apos;t connected yet.
          Connect more institutions for a more accurate average.
        </motion.p>
      )}
    </div>
  );
}

/* ── Step: Choose category ───────────────────────────────── */

function ChooseStep({
  categories,
  loading,
  onSelect,
  onCreateAll,
  creating,
  monthlyIncome,
  existingBudgets,
}) {
  const showOutlook =
    monthlyIncome > 0 && (categories.length > 0 || existingBudgets.length > 0);

  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]"
      >
        Create a budget
      </motion.h1>

      {showOutlook && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mt-10"
        >
          <MonthlyOutlook
            income={monthlyIncome}
            existingBudgets={existingBudgets}
            newCategories={categories}
          />
        </motion.div>
      )}

      <div className="mt-10">
        <SectionLabel className="mb-4">Where you spend consistently</SectionLabel>

        {loading ? (
          <div className="space-y-1">
            {[1, 0.62, 0.42, 0.3, 0.22].map((w, i) => (
              <div key={i} className="flex flex-col gap-2 py-2.5">
                <div className="flex items-baseline gap-4">
                  <div className="h-4 w-32 bg-[var(--color-border)] rounded animate-pulse" />
                  <div className="flex-1" />
                  <div className="h-3 w-12 bg-[var(--color-border)] rounded animate-pulse" />
                </div>
                <div
                  className="h-[3px] rounded-full bg-[var(--color-border)] animate-pulse"
                  style={{ width: `${w * 100}%` }}
                />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="py-8 text-sm text-[var(--color-muted)] text-center">
            {existingBudgets.length > 0
              ? "You've already got a budget for every category you spend on consistently."
              : "No recurring spending categories yet. Give your transactions a few weeks to sync."}
          </div>
        ) : (
          <CategoryProportionList
            categories={categories}
            onSelect={onSelect}
          />
        )}

        {/* Quick setup — alternate primary CTA */}
        {!loading && categories.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + categories.length * 0.03 + 0.1 }}
            className="mt-10"
          >
            <Button
              onClick={onCreateAll}
              disabled={creating}
              variant="outline"
              className="w-full h-11 gap-2"
            >
              {creating ? (
                "Creating budgets\u2026"
              ) : (
                <>
                  Set up all with suggested amounts
                  <FiChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
            <p className="mt-2 text-[11px] text-[var(--color-muted)] text-center">
              Or pick one above to tune it yourself
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function CategoryProportionList({ categories, onSelect }) {
  // The colored baseline under each row scales from 0–100% of the row width.
  // Biggest category fills the whole row; smaller ones shrink proportionally.
  const maxAmount = Math.max(
    ...categories.map((c) => Number(c.monthlyAvg || 0)),
    1
  );

  return (
    <div className="space-y-1">
      {categories.map((cat, i) => {
        const ratio = Math.max(0.04, Number(cat.monthlyAvg || 0) / maxAmount);
        return (
          <motion.button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat)}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + i * 0.03 }}
            className="group flex w-full flex-col gap-2 py-2.5 text-left cursor-pointer"
          >
            <div className="flex items-baseline gap-4">
              <span className="text-[15px] font-medium text-[var(--color-fg)]">
                {cat.label}
              </span>
              <span className="flex-1" />
              <span className="text-[13px] text-[var(--color-muted)] tabular-nums group-hover:text-[var(--color-fg)] transition-colors">
                ${cat.monthlyAvg.toLocaleString()}
                <span className="text-[11px] ml-0.5 opacity-60">/mo</span>
              </span>
              <FiChevronRight className="h-4 w-4 text-[var(--color-muted)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
            <motion.span
              className="h-[3px] rounded-full"
              initial={false}
              animate={{ width: `${ratio * 100}%` }}
              whileHover={{ scaleY: 1.8 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
              style={{
                backgroundColor: cat.hexColor,
                originX: 0,
                originY: 1,
              }}
            />
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── Step: Set amount ────────────────────────────────────── */

function AmountStep({
  category,
  amount,
  onAmountChange,
  spendingHistory,
  onCreate,
  creating,
  monthlyIncome,
  existingBudgets,
}) {
  const showOutlook = monthlyIncome > 0;
  const newAllocation = parseFloat(amount) || 0;
  // For the bar in this step, treat the in-progress amount as a single "new"
  // segment colored by the current category.
  const previewCategories = category
    ? [
        {
          id: category.id,
          label: category.label,
          monthlyAvg: newAllocation,
          hexColor: category.hexColor,
        },
      ]
    : [];

  return (
    <div>
      {/* Category header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex items-center gap-4 mb-10"
      >
        <CategoryDot
          hexColor={category.hexColor}
          iconName={category.iconName}
          iconLib={category.iconLib}
          size={44}
        />
        <div>
          <h1 className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]">
            {category.label}
          </h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            ${category.monthlyAvg.toLocaleString()}/mo average spend
          </p>
        </div>
      </motion.div>

      {/* Monthly outlook */}
      {showOutlook && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="mb-10"
        >
          <MonthlyOutlook
            income={monthlyIncome}
            existingBudgets={existingBudgets}
            newCategories={previewCategories}
          />
        </motion.div>
      )}

      {/* Amount input + recent spending inline */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="mb-10"
      >
        <div className="flex items-end justify-between gap-6">
          <div>
            <SectionLabel className="mb-1">Monthly budget</SectionLabel>
            <div
              className="flex items-baseline gap-1 cursor-text"
              onClick={() => document.getElementById("budget-amount-input")?.focus()}
            >
              <span className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)]">
                $
              </span>
              <input
                id="budget-amount-input"
                type="number"
                value={amount}
                onChange={(e) => onAmountChange(e.target.value)}
                autoFocus
                className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] tabular-nums bg-transparent border-none outline-none p-0 m-0 focus:ring-0 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                style={{
                  width: `${Math.max((amount?.toString().length || 1) * 0.65 + 0.3, 2)}em`,
                }}
              />
            </div>
          </div>

          {/* Recent spending — inline mini bars */}
          <InlineHistoryBars
            history={spendingHistory}
            hexColor={category.hexColor}
          />
        </div>
      </motion.div>

      {/* Create button */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Button
          onClick={onCreate}
          disabled={creating || !amount || parseFloat(amount) <= 0}
          className="w-full h-11"
        >
          {creating ? "Creating..." : "Create Budget"}
        </Button>
      </motion.div>
    </div>
  );
}

function InlineHistoryBars({ history, hexColor }) {
  const BAR_MAX_HEIGHT = 48;
  const isLoading = !history || history.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-end gap-2.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div className="h-3 w-8 bg-[var(--color-border)] rounded animate-pulse" />
            <div
              className="w-6 bg-[var(--color-border)] rounded-sm animate-pulse"
              style={{ height: `${12 + i * 8}px` }}
            />
            <div className="h-3 w-5 bg-[var(--color-border)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const maxSpend = Math.max(...history.map((m) => m.spending));

  return (
    <div className="flex items-end gap-2.5">
      {history.map((item, idx) => {
        const isZero = item.spending === 0;
        const heightPx =
          maxSpend > 0
            ? Math.max((item.spending / maxSpend) * BAR_MAX_HEIGHT, isZero ? 4 : 6)
            : 4;
        return (
          <div key={idx} className="flex flex-col items-center gap-1.5">
            <span
              className="text-[11px] tabular-nums"
              style={{
                fontWeight: isZero ? 400 : 600,
                color: isZero
                  ? "var(--color-muted)"
                  : "var(--color-fg)",
              }}
            >
              {isZero ? "$0" : formatCurrencyCompact(item.spending)}
            </span>
            <div
              className="w-6 rounded-sm"
              style={{
                height: `${heightPx}px`,
                backgroundColor: isZero
                  ? "var(--color-border)"
                  : hexColor || "var(--color-fg)",
                opacity: isZero ? 0.4 : 0.7,
              }}
            />
            <span className="text-[10px] text-[var(--color-muted)]">
              {item.month}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatCurrencyCompact(value) {
  const abs = Math.abs(value);
  if (abs >= 10000) {
    return `$${(value / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

/* ── Step: Done ──────────────────────────────────────────── */

function DoneStep({ budgets, onClose }) {
  const headline =
    budgets.length === 1
      ? "Budget created"
      : `${budgets.length} budgets created`;

  const maxAmount = Math.max(...budgets.map((b) => Number(b.amount || 0)), 1);

  return (
    <div>
      {/* Inline checkmark + headline */}
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 flex-shrink-0"
        >
          <FiCheck className="h-4 w-4 text-white" strokeWidth={3} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]"
        >
          {headline}
        </motion.h1>
      </div>

      {/* Budget list with proportional baseline bars */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mt-10 space-y-1"
      >
        {budgets.map((b, i) => {
          const ratio = Math.max(0.04, Number(b.amount || 0) / maxAmount);
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 + i * 0.04 }}
              className="flex flex-col gap-2 py-2.5"
            >
              <div className="flex items-baseline gap-4">
                <span className="text-[15px] font-medium text-[var(--color-fg)]">
                  {b.label}
                </span>
                <span className="flex-1" />
                <span className="text-[13px] text-[var(--color-muted)] tabular-nums">
                  ${b.amount.toLocaleString()}
                  <span className="text-[11px] ml-0.5 opacity-60">/mo</span>
                </span>
              </div>
              <motion.span
                className="h-[3px] rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${ratio * 100}%` }}
                transition={{
                  type: "spring",
                  stiffness: 320,
                  damping: 26,
                  delay: 0.55 + i * 0.04,
                }}
                style={{
                  backgroundColor: b.hexColor,
                  originX: 0,
                }}
              />
            </motion.div>
          );
        })}
      </motion.div>

      {/* Done button */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: budgets.length > 0 ? 0.6 + budgets.length * 0.04 : 0.5,
        }}
        className="mt-10"
      >
        <Button onClick={onClose} className="w-full h-11">
          Done
        </Button>
      </motion.div>
    </div>
  );
}
