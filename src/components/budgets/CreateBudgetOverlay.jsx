"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCheck, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { FiTag } from "react-icons/fi";
import Button from "../ui/Button";
import DynamicIcon from "../DynamicIcon";
import { LuSparkles } from "react-icons/lu";

export default function CreateBudgetOverlay({
  isOpen,
  onClose,
  onCreated,
  monthlyIncome = 0,
  existingBudgets = [],
}) {
  const [step, setStep] = useState("choose"); // choose | amount | creating | done
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [amount, setAmount] = useState("");
  const [spendingHistory, setSpendingHistory] = useState([]);
  const [createdBudgets, setCreatedBudgets] = useState([]);
  const [creating, setCreating] = useState(false);

  // Reset state after overlay closes (delay for exit animation).
  useEffect(() => {
    if (isOpen) return;
    const t = setTimeout(() => {
      setStep("choose");
      setCategories([]);
      setSelectedCategory(null);
      setAmount("");
      setSpendingHistory([]);
      setCreatedBudgets([]);
      setCreating(false);
      setLoading(true);
    }, 250);
    return () => clearTimeout(t);
  }, [isOpen]);

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

  // Fetch categories when opened.
  useEffect(() => {
    if (!isOpen) return;
    fetchCategories();
  }, [isOpen]);

  async function fetchCategories() {
    setLoading(true);
    try {
      const res = await fetch(
        "/api/transactions/spending-by-category?days=120&forBudget=true"
      );
      const data = await res.json();
      const months = data.completeMonths || 1;

      const cats = (data.categories || [])
        .filter((c) => c.total_spent > 0 && c.label !== "Account Transfer")
        .sort((a, b) => b.total_spent - a.total_spent)
        .map((c) => ({
          id: c.id,
          label: c.label,
          monthlyAvg: Math.round(c.total_spent / months),
          hexColor: c.hex_color || "#6B7280",
          iconName: c.icon_name,
          iconLib: c.icon_lib,
        }));

      setCategories(cats);
    } catch (e) {
      console.error("Failed to fetch categories:", e);
    } finally {
      setLoading(false);
    }
  }

  async function fetchHistory(categoryId) {
    try {
      const res = await fetch(
        `/api/transactions/category-history?categoryId=${categoryId}&months=4`
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
    fetchHistory(cat.id);
  };

  const handleBack = () => {
    setSelectedCategory(null);
    setAmount("");
    setSpendingHistory([]);
    setStep("choose");
  };

  const createBudget = async (categoryId, budgetAmount) => {
    const res = await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(budgetAmount),
        period: "monthly",
        category_id: categoryId,
      }),
    });
    if (!res.ok) throw new Error("Failed to create budget");
    return res.json();
  };

  const handleCreateSingle = async () => {
    if (!selectedCategory || !amount) return;
    setCreating(true);
    try {
      await createBudget(selectedCategory.id, amount);
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
        categories.map((cat) => createBudget(cat.id, cat.monthlyAvg))
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
            <div className="w-full max-w-md">
              <AnimatePresence mode="wait">
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
                      monthlyIncome={monthlyIncome}
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
                      onBack={handleBack}
                      onCreate={handleCreateSingle}
                      creating={creating}
                      monthlyIncome={monthlyIncome}
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
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ── Shared primitives ────────────────────────────────────── */

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
  const barTotal = Math.max(income, totalAllocated);

  // Build segments: existing first (muted), then new (colored), then unallocated track.
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
      return { id: `existing-${b.id}`, amount: amt, color, label, dim: true };
    })
    .filter(Boolean);

  const newSegments = newCategories
    .map((c) => {
      const amt = Number(c.monthlyAvg || 0);
      if (amt <= 0) return null;
      return {
        id: `new-${c.id}`,
        amount: amt,
        color: c.hexColor || "var(--color-muted)",
        label: c.label,
        dim: false,
      };
    })
    .filter(Boolean);

  const segments = [...existingSegments, ...newSegments];

  return (
    <div>
      <SectionLabel className="mb-3">Monthly outlook</SectionLabel>

      <div className="flex items-end justify-between mb-3">
        <div>
          <div className="text-[22px] font-medium text-[var(--color-fg)] tabular-nums leading-tight">
            ${Math.round(income).toLocaleString()}
          </div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
            average income
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-[22px] font-medium tabular-nums leading-tight"
            style={{
              color: overAllocated > 0 ? "var(--color-danger)" : "var(--color-fg)",
            }}
          >
            ${Math.round(overAllocated > 0 ? overAllocated : remaining).toLocaleString()}
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
            <div
              key={seg.id}
              className="h-full"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                opacity: seg.dim ? 0.45 : 1,
              }}
              title={`${seg.label} · $${Math.round(seg.amount).toLocaleString()}`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3 text-[11px] text-[var(--color-muted)]">
        <span className="tabular-nums">
          ${Math.round(totalAllocated).toLocaleString()} budgeted
          {existingTotal > 0 && newTotal > 0
            ? ` (${Math.round(existingTotal).toLocaleString()} existing)`
            : ""}
        </span>
        <span className="tabular-nums">
          {income > 0 ? Math.round((totalAllocated / income) * 100) : 0}% of income
        </span>
      </div>
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

      <div className="mt-10 space-y-10">
        {/* Category list */}
        <div>
          <SectionLabel className="mb-2">Your spending categories</SectionLabel>

          {loading ? (
            <div className="divide-y divide-[var(--color-border)]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 py-4">
                  <div className="w-9 h-9 rounded-full bg-[var(--color-border)] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-24 bg-[var(--color-border)] rounded animate-pulse" />
                    <div className="h-3 w-16 bg-[var(--color-border)] rounded animate-pulse" />
                  </div>
                  <div className="h-4 w-14 bg-[var(--color-border)] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : categories.length === 0 ? (
            <div className="py-8 text-sm text-[var(--color-muted)] text-center">
              No spending categories found. Transactions need to sync first.
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {categories.map((cat, i) => (
                <motion.button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelect(cat)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.04 }}
                  whileHover={{ x: 2 }}
                  className="group flex w-full items-center gap-4 py-4 text-left cursor-pointer"
                >
                  <CategoryDot
                    hexColor={cat.hexColor}
                    iconName={cat.iconName}
                    iconLib={cat.iconLib}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-medium text-[var(--color-fg)] truncate">
                      {cat.label}
                    </div>
                    <div className="text-xs text-[var(--color-muted)] mt-0.5">
                      ${cat.monthlyAvg.toLocaleString()}/mo avg
                    </div>
                  </div>
                  <FiChevronRight className="h-4 w-4 text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Set up all action */}
        {!loading && categories.length > 0 && (
          <div>
            <SectionLabel className="mb-2">Quick setup</SectionLabel>
            <div>
              <motion.button
                type="button"
                onClick={onCreateAll}
                disabled={creating}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + categories.length * 0.04 }}
                whileHover={{ x: 2 }}
                className="group flex w-full items-center gap-4 py-4 text-left cursor-pointer disabled:opacity-50"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex-shrink-0">
                  <LuSparkles className="h-4 w-4 text-[var(--color-muted)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-[var(--color-fg)] truncate">
                    {creating ? "Creating budgets..." : "Set up all budgets"}
                  </div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    Auto-create based on your spending averages
                  </div>
                </div>
                <FiChevronRight className="h-4 w-4 text-[var(--color-muted)] group-hover:text-[var(--color-fg)] transition-colors flex-shrink-0" />
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Step: Set amount ────────────────────────────────────── */

function AmountStep({
  category,
  amount,
  onAmountChange,
  spendingHistory,
  onBack,
  onCreate,
  creating,
  monthlyIncome,
  existingBudgets,
}) {
  const maxSpend =
    spendingHistory.length > 0
      ? Math.max(...spendingHistory.map((m) => m.spending))
      : 0;

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
      {/* Back link */}
      <motion.button
        type="button"
        onClick={onBack}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors cursor-pointer mb-8"
      >
        <FiChevronLeft className="h-4 w-4" />
        Back
      </motion.button>

      {/* Category header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
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
          transition={{ delay: 0.11 }}
          className="mb-10"
        >
          <MonthlyOutlook
            income={monthlyIncome}
            existingBudgets={existingBudgets}
            newCategories={previewCategories}
          />
        </motion.div>
      )}

      {/* Amount input */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14 }}
        className="mb-10"
      >
        <SectionLabel className="mb-3">Monthly budget</SectionLabel>
        <div
          className="flex items-baseline gap-1 cursor-text"
          onClick={() => document.getElementById("budget-amount-input")?.focus()}
        >
          <span className="text-4xl font-medium text-[var(--color-fg)]">$</span>
          <input
            id="budget-amount-input"
            type="number"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            autoFocus
            className="text-4xl font-medium text-[var(--color-fg)] bg-transparent border-none outline-none p-0 m-0 focus:ring-0 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            style={{
              width: `${Math.max((amount?.toString().length || 1) * 0.65 + 0.3, 2)}em`,
            }}
          />
        </div>
      </motion.div>

      {/* Spending history chart */}
      {spendingHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <SectionLabel className="mb-3">Recent spending</SectionLabel>
          <div className="flex items-end gap-4">
            {spendingHistory.map((item, idx) => {
              const heightPx =
                maxSpend > 0
                  ? Math.max((item.spending / maxSpend) * 64, 8)
                  : 8;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
                    ${item.spending.toLocaleString()}
                  </span>
                  <div
                    className="w-full max-w-[48px] rounded-sm"
                    style={{
                      height: `${heightPx}px`,
                      backgroundColor: category.hexColor,
                      opacity: 0.7,
                    }}
                  />
                  <span className="text-[11px] text-[var(--color-muted)]">
                    {item.month}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Skeleton while history loads */}
      {spendingHistory.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-10"
        >
          <SectionLabel className="mb-3">Recent spending</SectionLabel>
          <div className="flex items-end gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="h-3 w-8 bg-[var(--color-border)] rounded animate-pulse" />
                <div
                  className="w-full max-w-[48px] bg-[var(--color-border)] rounded-sm animate-pulse"
                  style={{ height: `${16 + i * 12}px` }}
                />
                <div className="h-3 w-6 bg-[var(--color-border)] rounded animate-pulse" />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Create button */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.26 }}
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

/* ── Step: Done ──────────────────────────────────────────── */

function DoneStep({ budgets, onClose }) {
  const headline =
    budgets.length === 1
      ? "Budget created"
      : `${budgets.length} budgets created`;

  return (
    <div>
      {/* Checkmark */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        className="mb-8 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500"
      >
        <FiCheck className="h-5 w-5 text-white" strokeWidth={3} />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-[26px] font-medium tracking-tight text-[var(--color-fg)]"
      >
        {headline}
      </motion.h1>

      {/* Budget list */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="mt-10"
      >
        <SectionLabel className="mb-2">
          {budgets.length === 1 ? "Budget" : "Budgets"}
        </SectionLabel>
        <div className="divide-y divide-[var(--color-border)]">
          {budgets.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 + i * 0.04 }}
              className="flex items-center gap-4 py-4"
            >
              <CategoryDot
                hexColor={b.hexColor}
                iconName={b.iconName}
                iconLib={b.iconLib}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium text-[var(--color-fg)] truncate">
                  {b.label}
                </div>
              </div>
              <div className="text-sm tabular-nums text-[var(--color-muted)] flex-shrink-0">
                ${b.amount.toLocaleString()}/mo
              </div>
            </motion.div>
          ))}
        </div>
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
