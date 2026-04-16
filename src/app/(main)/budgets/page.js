"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '../../../components/providers/UserProvider';
import PageContainer from '../../../components/layout/PageContainer';
import CreateBudgetOverlay from '../../../components/budgets/CreateBudgetOverlay';
import DynamicIcon from '../../../components/DynamicIcon';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import LineChart from '../../../components/ui/LineChart';
import UpgradeOverlay from '../../../components/UpgradeOverlay';
import { Dropdown, EmptyState } from '@slate-ui/react';
import { FiTag } from 'react-icons/fi';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import { formatCurrency } from '../../../lib/formatCurrency';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export default function BudgetsPage() {
  const { user, profile, isPro, refreshProfile } = useUser();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fallbackIncome, setFallbackIncome] = useState(0);
  const [incomeMonths, setIncomeMonths] = useState([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [categoryStats, setCategoryStats] = useState([]);
  const [addingSuggestionId, setAddingSuggestionId] = useState(null);
  const [burnSeries, setBurnSeries] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState([]);
  const [selectedHistoryCategory, setSelectedHistoryCategory] = useState('all');

  // Selection + delete state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const fetchBudgets = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/budgets`);
      const json = await res.json();
      setBudgets(json.data || []);
      setBurnSeries(Array.isArray(json.burn) ? json.burn : []);
      setBudgetHistory(Array.isArray(json.history) ? json.history : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fallback income calc — only used if the profile has no saved value
  // yet (e.g. legacy users who created budgets before we started
  // persisting it). First-time users go through CreateBudgetOverlay which
  // writes the confirmed income to user_profiles.
  const fetchIncome = async () => {
    if (!user?.id) return;
    setIncomeLoading(true);
    try {
      const res = await fetch(`/api/transactions/spending-earning?months=6`);
      const json = await res.json();
      const months = Array.isArray(json?.data) ? json.data : [];
      const completed = months.filter((m) => m.isComplete);
      const sample = completed.length > 0 ? completed : months;
      // Auto-exclude $0 months — they almost always mean the account
      // wasn't connected yet, not a real zero-earning month.
      const nonZero = sample.filter((m) => Number(m.earning || 0) > 0);
      const source = nonZero.length > 0 ? nonZero : sample;
      const totalEarning = source.reduce(
        (sum, m) => sum + Number(m.earning || 0),
        0
      );
      const avg = source.length > 0 ? totalEarning / source.length : 0;
      setFallbackIncome(avg);
      setIncomeMonths(sample);
    } catch (e) {
      console.error(e);
      setFallbackIncome(0);
      setIncomeMonths([]);
    } finally {
      setIncomeLoading(false);
    }
  };

  // Used for suggestion cards + coverage % in the hero. Same endpoint
  // CreateBudgetOverlay uses — gives us typical monthly spend per group.
  const fetchCategoryStats = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(
        '/api/transactions/spending-by-category?days=120&forBudget=true&groupBy=group'
      );
      const json = await res.json();
      const cats = (json.categories || [])
        .filter((c) => c.total_spent > 0 && c.label !== 'Account Transfer');
      setCategoryStats(cats);
    } catch (e) {
      console.error(e);
      setCategoryStats([]);
    }
  };

  useEffect(() => {
    fetchBudgets();
    fetchIncome();
    fetchCategoryStats();
  }, [user?.id]);

  // Exit select mode automatically when no budgets remain.
  useEffect(() => {
    if (budgets.length === 0 && selectMode) {
      setSelectMode(false);
      setSelectedIds(new Set());
    }
  }, [budgets.length, selectMode]);

  // Profile-saved income is the source of truth. Fall back to computed
  // average only while loading or for legacy users.
  const savedIncome = Number(profile?.monthly_income || 0);
  const income = savedIncome > 0 ? savedIncome : Number(fallbackIncome || 0);

  const totalAllocated = useMemo(
    () => budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0),
    [budgets]
  );

  const sortedBudgets = useMemo(
    () =>
      [...budgets].sort(
        (a, b) => Number(b.amount || 0) - Number(a.amount || 0)
      ),
    [budgets]
  );

  const hasIncome = income > 0;
  const unallocated = Math.max(0, income - totalAllocated);
  const overAllocated = Math.max(0, totalAllocated - income);
  const allocatedPct = hasIncome ? (totalAllocated / income) * 100 : 0;

  // ─── Pacing: where we should be in the month ───────────────────────
  const pace = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0
    ).getDate();
    return {
      day,
      daysInMonth,
      // Fraction of the month that's elapsed (0..1). Proportional pacing
      // is fine for budgets — weekend spikes average out over the month.
      fraction: Math.min(1, day / daysInMonth),
    };
  }, []);

  // ─── Coverage: % of typical monthly spend covered by budgets ───────
  const coverage = useMemo(() => {
    if (!categoryStats.length) return null;
    const budgetedGroupIds = new Set(
      budgets.map((b) => b.category_group_id).filter(Boolean)
    );
    const totalSpend = categoryStats.reduce(
      (sum, c) => sum + Number(c.monthly_avg || 0),
      0
    );
    if (totalSpend <= 0) return null;
    const coveredSpend = categoryStats
      .filter((c) => budgetedGroupIds.has(c.id))
      .reduce((sum, c) => sum + Number(c.monthly_avg || 0), 0);
    const uncovered = Math.max(0, totalSpend - coveredSpend);
    return {
      pct: (coveredSpend / totalSpend) * 100,
      uncoveredAmount: uncovered,
      totalSpend,
    };
  }, [categoryStats, budgets]);

  // ─── Suggestions: top unbudgeted categories worth a budget ─────────
  const suggestions = useMemo(() => {
    if (!categoryStats.length) return [];
    const budgetedGroupIds = new Set(
      budgets.map((b) => b.category_group_id).filter(Boolean)
    );
    return categoryStats
      .filter((c) => !budgetedGroupIds.has(c.id))
      .filter((c) => Number(c.monthly_avg || 0) > 0)
      .sort((a, b) => Number(b.monthly_avg || 0) - Number(a.monthly_avg || 0))
      .slice(0, 4);
  }, [categoryStats, budgets]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(sortedBudgets.map((b) => b.id)));
  const clearSelection = () => setSelectedIds(new Set());
  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
  };
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const requestDelete = (ids) => {
    setPendingDeleteIds(ids);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (pendingDeleteIds.length === 0) return;
    setDeleting(true);
    try {
      await Promise.all(
        pendingDeleteIds.map((id) =>
          fetch(`/api/budgets?id=${id}`, { method: 'DELETE' })
        )
      );
      await fetchBudgets();
      setConfirmOpen(false);
      setPendingDeleteIds([]);
      if (selectMode) exitSelectMode();
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const handleBudgetCreated = async () => {
    await Promise.all([
      fetchBudgets(),
      fetchCategoryStats(),
      refreshProfile?.(),
    ]);
  };

  const handleQuickAddSuggestion = async (suggestion) => {
    if (addingSuggestionId) return;
    setAddingSuggestionId(suggestion.id);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(Number(suggestion.monthly_avg || 0)),
          period: 'monthly',
          category_group_id: suggestion.id,
        }),
      });
      if (!res.ok) throw new Error('Failed to add budget');
      await Promise.all([fetchBudgets(), fetchCategoryStats()]);
    } catch (e) {
      console.error(e);
    } finally {
      setAddingSuggestionId(null);
    }
  };

  if (!isPro) {
    return (
      <>
        <EmptyState>
          <EmptyState.Hero
            layout="split"
            title="Budgets — Pro Feature"
            description="Upgrade to Pro to create budgets, track spending by category, and get insights into your financial health."
            action={
              <Button size="lg" onClick={() => setShowUpgradeModal(true)} className="gap-2">
                Upgrade to Pro
              </Button>
            }
          />
        </EmptyState>
        <UpgradeOverlay isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
      </>
    );
  }

  // ─── Header action ─────────────────────────────────────────────────
  const hasBudgets = budgets.length > 0;
  const selectedCount = selectedIds.size;

  const headerAction = hasBudgets ? (
    selectMode ? (
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-muted)] tabular-nums hidden sm:inline">
          {selectedCount} selected
        </span>
        <button
          type="button"
          onClick={selectedCount === sortedBudgets.length ? clearSelection : selectAll}
          className="text-xs font-medium text-[var(--color-fg)] hover:opacity-70 transition-opacity px-2 py-1"
        >
          {selectedCount === sortedBudgets.length ? 'Clear' : 'Select all'}
        </button>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={() => requestDelete(Array.from(selectedIds))}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full text-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger),transparent_92%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <LuTrash2 className="w-3.5 h-3.5" />
          Delete
        </button>
        <button
          type="button"
          onClick={exitSelectMode}
          className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors px-2 py-1"
        >
          Done
        </button>
      </div>
    ) : (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={enterSelectMode}
          className="text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors px-2 py-1"
        >
          Select
        </button>
        <Button
          size="sm"
          variant="matte"
          onClick={() => setIsModalOpen(true)}
          className="gap-1.5 !rounded-full pl-3 pr-4"
        >
          <LuPlus className="w-3.5 h-3.5" />
          New Budget
        </Button>
      </div>
    )
  ) : null;

  // ─── Empty state ───────────────────────────────────────────────────
  if (!loading && !hasBudgets) {
    return (
      <PageContainer title="Budgets">
        <EmptyState>
          <div className="py-16 lg:py-24 max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-[var(--color-fg)] leading-[1.15] mb-6">
              Set a monthly limit.<br />
              See where your money goes.
            </h2>
            <p className="text-sm text-[var(--color-muted)] leading-relaxed max-w-md mb-10">
              We&apos;ll pull your last three months of spending and suggest a starting
              amount for each category. Accept the suggestions as-is, or tune them
              to match your plan.
            </p>
            <Button size="lg" onClick={() => setIsModalOpen(true)}>
              Create your first budget
            </Button>
          </div>
        </EmptyState>

        <CreateBudgetOverlay
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreated={handleBudgetCreated}
          monthlyIncome={income}
          incomeMonths={incomeMonths}
          existingBudgets={budgets}
        />
      </PageContainer>
    );
  }

  // ─── Main content ──────────────────────────────────────────────────
  return (
    <PageContainer title="Budgets" action={headerAction}>
      {loading ? (
        <BudgetsSkeleton />
      ) : (
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Main panel — chart on top, budgets list below */}
          <div className="lg:w-2/3 flex flex-col gap-10">
            <BurnDownChart
              series={burnSeries}
              totalAllocated={totalAllocated}
              income={income}
              hasIncome={hasIncome}
              allocatedPct={allocatedPct}
              unallocated={unallocated}
              overAllocated={overAllocated}
              pace={pace}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <BudgetPerformanceChart
                history={budgetHistory}
                budgets={sortedBudgets}
                selectedCategory={selectedHistoryCategory}
                onCategoryChange={setSelectedHistoryCategory}
              />

              <div>
                <div className="mb-4 px-1">
                  <h2 className="text-lg font-medium text-[var(--color-fg)]">Your budgets</h2>
                </div>
                <div className="flex flex-col">
                  {sortedBudgets.map((b, i) => (
                    <BudgetRow
                      key={b.id}
                      budget={b}
                      income={income}
                      hasIncome={hasIncome}
                      pace={pace}
                      selectMode={selectMode}
                      selected={selectedIds.has(b.id)}
                      onToggleSelect={() => toggleSelect(b.id)}
                      onDelete={() => requestDelete([b.id])}
                      isLast={i === sortedBudgets.length - 1}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Side panel — allocation breakdown + stats + suggestions */}
          <div className="lg:w-1/3 flex flex-col gap-10">
            <AllocationBreakdown
              sortedBudgets={sortedBudgets}
              totalAllocated={totalAllocated}
              income={income}
              hasIncome={hasIncome}
              unallocated={unallocated}
              overAllocated={overAllocated}
            />

            {(coverage || pace) && (
              <div>
                <h2 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-4">
                  Month status
                </h2>
                <dl className="space-y-3.5 text-xs">
                  {pace && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">Progress</dt>
                      <dd className="text-[var(--color-fg)] tabular-nums font-medium">
                        Day {pace.day} of {pace.daysInMonth}
                      </dd>
                    </div>
                  )}
                  {pace && totalAllocated > 0 && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">Expected spend</dt>
                      <dd className="text-[var(--color-fg)] tabular-nums font-medium">
                        {formatCurrency(totalAllocated * pace.fraction)}
                      </dd>
                    </div>
                  )}
                  {coverage && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">Coverage</dt>
                      <dd className="text-[var(--color-fg)] tabular-nums font-medium">
                        {coverage.pct.toFixed(0)}% of spending
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {suggestions.length > 0 && !selectMode && (
              <div id="budget-suggestions">
                <h2 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-4">
                  Suggested
                </h2>
                <div className="flex flex-col">
                  {suggestions.map((s, i) => (
                    <SuggestionRow
                      key={s.id}
                      suggestion={s}
                      income={income}
                      hasIncome={hasIncome}
                      adding={addingSuggestionId === s.id}
                      disabled={!!addingSuggestionId && addingSuggestionId !== s.id}
                      onAdd={() => handleQuickAddSuggestion(s)}
                      isLast={i === suggestions.length - 1}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      <CreateBudgetOverlay
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={handleBudgetCreated}
        monthlyIncome={income}
        incomeMonths={incomeMonths}
        existingBudgets={budgets}
      />
      <UpgradeOverlay isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

      <ConfirmDialog
        isOpen={confirmOpen}
        variant="danger"
        title={
          pendingDeleteIds.length > 1
            ? `Delete ${pendingDeleteIds.length} budgets?`
            : 'Delete budget?'
        }
        description={
          pendingDeleteIds.length > 1
            ? 'These budgets will be permanently removed. Your transactions and spending history will not be affected.'
            : 'This budget will be permanently removed. Your transactions and spending history will not be affected.'
        }
        confirmLabel={pendingDeleteIds.length > 1 ? `Delete ${pendingDeleteIds.length}` : 'Delete'}
        busy={deleting}
        onCancel={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setPendingDeleteIds([]);
        }}
        onConfirm={handleConfirmDelete}
      />
    </PageContainer>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getColor(b) {
  const isGroup = !!b.category_groups;
  if (isGroup) return b.category_groups?.hex_color || '#71717a';
  return b.system_categories?.hex_color || '#71717a';
}

function getLabel(b) {
  const isGroup = !!b.category_groups;
  return isGroup
    ? b.category_groups.name
    : b.system_categories?.label || 'Unknown';
}

function getIconMeta(b) {
  // Pull icon metadata from whichever side the budget is attached to.
  // The DB stores icons with a library key (e.g. "Fi") + a name
  // (e.g. "FiCoffee") so we can resolve them via DynamicIcon.
  const isGroup = !!b.category_groups;
  const src = isGroup ? b.category_groups : b.system_categories;
  return {
    iconName: src?.icon_name || null,
    iconLib: src?.icon_lib || null,
  };
}

// Reusable circular icon — solid color fill with a white icon on top.
function CategoryIcon({ iconName, iconLib, color, size = 36 }) {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: color || 'var(--color-muted)',
      }}
    >
      <DynamicIcon
        iconLib={iconLib}
        iconName={iconName}
        className="text-white"
        style={{ width: size * 0.42, height: size * 0.42 }}
        fallback={FiTag}
      />
    </div>
  );
}

// ─── Allocation breakdown ────────────────────────────────────────────
// Portfolio-style card: total at top, segmented bar showing each budget
// against income, then a legend row per budget with $ and %. Matches
// the visual language of the investments page's AllocationCard.

function AllocationBreakdown({
  sortedBudgets,
  totalAllocated,
  income,
  hasIncome,
  unallocated,
  overAllocated,
}) {
  const [hoveredId, setHoveredId] = useState(null);

  // Denominator: income if we know it, otherwise total allocated.
  const denom = hasIncome ? Math.max(income, totalAllocated) : totalAllocated;

  // Unallocated is treated as a pseudo-segment so it shows in both the
  // bar and the legend.
  const unallocatedSeg =
    hasIncome && unallocated > 0
      ? { id: '__unallocated', label: 'Unallocated', amount: unallocated, color: 'var(--color-border)', muted: true }
      : null;

  const segments = [
    ...sortedBudgets.map((b) => ({
      id: b.id,
      label: getLabel(b),
      amount: Number(b.amount || 0),
      color: getColor(b),
      muted: false,
    })),
    ...(unallocatedSeg ? [unallocatedSeg] : []),
  ];

  const overLabel =
    overAllocated > 0 ? `${formatCurrency(overAllocated)} over income` : null;

  return (
    <div>
      <div className="mb-5">
        <div className="card-header">Allocation</div>
      </div>

      <div className="mb-4 flex items-baseline justify-between">
        <span className="text-sm font-medium text-[var(--color-fg)]">
          Total Budgeted
        </span>
        <span className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
          {formatCurrency(totalAllocated)}
          {hasIncome && (
            <span className="text-[var(--color-muted)] font-normal">
              {' '}/ {formatCurrency(income)}
            </span>
          )}
        </span>
      </div>

      {/* Segmented bar */}
      <div
        className="mb-5 flex h-3 w-full overflow-hidden rounded-full bg-[var(--color-surface-alt)]"
        onMouseLeave={() => setHoveredId(null)}
      >
        {segments.map((seg) => {
          const pct = denom > 0 ? (seg.amount / denom) * 100 : 0;
          if (pct <= 0) return null;
          const isDimmed = hoveredId && hoveredId !== seg.id;
          return (
            <div
              key={seg.id}
              className="h-full cursor-pointer transition-all duration-200"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                opacity: isDimmed ? 0.3 : seg.muted ? 0.6 : 1,
              }}
              onMouseEnter={() => setHoveredId(seg.id)}
              title={`${seg.label} · ${formatCurrency(seg.amount)}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="space-y-3">
        {segments.map((seg) => {
          const pct = denom > 0 ? (seg.amount / denom) * 100 : 0;
          const isHovered = hoveredId === seg.id;
          const isDimmed = hoveredId && !isHovered;
          return (
            <div
              key={seg.id}
              className={`flex cursor-pointer items-center justify-between text-xs transition-opacity duration-200 ${
                isDimmed ? 'opacity-40' : 'opacity-100'
              }`}
              onMouseEnter={() => setHoveredId(seg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span
                  className={`font-medium truncate ${
                    seg.muted ? 'text-[var(--color-muted)]' : 'text-[var(--color-muted)]'
                  } ${isHovered ? 'text-[var(--color-fg)]' : ''}`}
                >
                  {seg.label}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span
                  className={`tabular-nums font-semibold ${
                    seg.muted ? 'text-[var(--color-muted)]' : 'text-[var(--color-fg)]'
                  }`}
                >
                  {formatCurrency(seg.amount)}
                </span>
                <span className="font-medium font-mono text-[10px] text-[var(--color-muted)] w-10 text-right">
                  {pct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {overLabel && (
        <p className="mt-4 text-[11px] text-[var(--color-danger)] tabular-nums">
          {overLabel}
        </p>
      )}
    </div>
  );
}

// ─── Budget row ───────────────────────────────────────────────────────

function BudgetRow({
  budget,
  income,
  hasIncome,
  pace,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
  isLast,
}) {
  const { iconName, iconLib } = getIconMeta(budget);
  const color = getColor(budget);
  const label = getLabel(budget);
  const amount = Number(budget.amount || 0);
  const spent = Number(budget.spent || 0);
  const spendPct = Number(budget.percentage || 0);
  const hasSpending = spent > 0 || spendPct > 0;
  const allocPct = hasIncome && amount > 0 ? (amount / income) * 100 : 0;

  const expectedPct = pace ? pace.fraction * 100 : null;
  const expectedAmount = pace ? amount * pace.fraction : null;
  const paceDelta = expectedAmount != null ? spent - expectedAmount : null;
  const overPace =
    expectedPct != null && spendPct > expectedPct + 2 && spendPct < 100;
  const underPace =
    expectedPct != null && hasSpending && spendPct < expectedPct - 2;

  const handleRowClick = () => {
    if (selectMode) onToggleSelect();
  };

  return (
    <div
      onClick={handleRowClick}
      className={`
        group relative flex items-center gap-4 py-4 px-2 -mx-2 rounded-lg transition-colors
        ${!isLast ? 'border-b border-[color-mix(in_oklab,var(--color-fg),transparent_93%)]' : ''}
        ${selectMode ? 'cursor-pointer' : ''}
        ${selected ? 'bg-[var(--color-card-highlight)]' : 'hover:bg-[var(--color-card-highlight)]'}
      `}
    >
      {selectMode && (
        <div
          className={`
            w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0
            transition-colors
            ${selected
              ? 'bg-[var(--color-fg)] border-[var(--color-fg)]'
              : 'border-[var(--color-border)] bg-transparent'}
          `}
        >
          {selected && (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8.5L6.5 12L13 5"
                stroke="var(--color-content-bg)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      )}

      <CategoryIcon iconName={iconName} iconLib={iconLib} color={color} size={36} />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--color-fg)] truncate">{label}</p>
        <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
          {hasIncome && `${allocPct.toFixed(0)}% of income`}
          {spendPct >= 100 && (
            <span className="text-[var(--color-danger)]"> · over budget</span>
          )}
          {overPace && paceDelta != null && (
            <span className="text-[#b45309]">
              {' '}· {formatCurrency(paceDelta)} ahead of pace
            </span>
          )}
          {underPace && paceDelta != null && Math.abs(paceDelta) >= 1 && (
            <span className="text-[var(--color-muted)]">
              {' '}· {formatCurrency(Math.abs(paceDelta))} under pace
            </span>
          )}
          {!hasIncome && !hasSpending && 'No spending yet'}
        </p>
      </div>

      <div className="flex-shrink-0">
        <p className="text-sm tabular-nums whitespace-nowrap text-right">
          <span
            className="font-semibold"
            style={{
              color:
                spendPct >= 100
                  ? 'var(--color-danger)'
                  : 'var(--color-fg)',
            }}
          >
            {formatCurrency(spent)}
          </span>
          <span className="text-[var(--color-muted)]"> / {formatCurrency(amount)}</span>
        </p>
      </div>

      {!selectMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--color-muted)] hover:text-[var(--color-danger)] rounded transition-opacity"
          title="Delete budget"
          aria-label={`Delete ${label} budget`}
        >
          <LuTrash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ─── Budget Performance chart ────────────────────────────────────────
// Vertical bar chart: bars go UP (green) when under budget, DOWN (red)
// when over. The zero line is the budget amount. A category dropdown
// lets the user drill into individual budgets.

function BudgetPerformanceChart({ history, budgets, selectedCategory, onCategoryChange }) {
  const chartData = useMemo(() => {
    if (!Array.isArray(history) || history.length === 0) return [];
    return history.map((bucket) => {
      let totalBudget = 0;
      let totalSpent = 0;

      if (selectedCategory === 'all') {
        bucket.budgets.forEach((bb) => {
          totalBudget += bb.amount;
          totalSpent += bb.spent;
        });
      } else {
        const match = bucket.budgets.find((bb) => bb.id === selectedCategory);
        if (match) {
          totalBudget = match.amount;
          totalSpent = match.spent;
        }
      }

      const delta = totalBudget - totalSpent; // positive = under budget
      return {
        month: bucket.month,
        year: bucket.year,
        isCurrent: bucket.isCurrent,
        delta,
        spent: totalSpent,
        budget: totalBudget,
      };
    });
  }, [history, selectedCategory]);

  const dropdownItems = useMemo(() => {
    const items = [
      {
        label: 'All budgets',
        onClick: () => onCategoryChange('all'),
        selected: selectedCategory === 'all',
      },
    ];
    budgets.forEach((b) => {
      items.push({
        label: getLabel(b),
        onClick: () => onCategoryChange(b.id),
        selected: selectedCategory === b.id,
      });
    });
    return items;
  }, [budgets, selectedCategory, onCategoryChange]);

  const selectedLabel = selectedCategory === 'all'
    ? 'All budgets'
    : getLabel(budgets.find((b) => b.id === selectedCategory) || {});

  const formatYAxis = (v) => {
    const abs = Math.abs(v);
    if (abs >= 1000) return `$${(v / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
    return `$${Math.round(v)}`;
  };

  if (!chartData.length) {
    return (
      <div>
        <div className="card-header mb-4">Budget Performance</div>
        <div className="h-[240px] flex items-center justify-center text-sm text-[var(--color-muted)]">
          No history data yet
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="card-header">Budget Performance</div>
        <Dropdown
          label={selectedLabel}
          items={dropdownItems}
          size="sm"
          align="right"
        />
      </div>

      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--color-muted)' }}
              tickFormatter={formatYAxis}
              width={48}
            />
            <ReferenceLine y={0} stroke="var(--color-border)" strokeWidth={1} />
            <Tooltip
              content={<PerformanceTooltip />}
              cursor={{ fill: 'var(--color-card-highlight)', opacity: 0.5 }}
            />
            <Bar dataKey="delta" radius={[4, 4, 4, 4]} maxBarSize={36}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
                  opacity={entry.isCurrent ? 0.5 : 0.85}
                  {...(entry.isCurrent ? { strokeDasharray: '4 2', stroke: entry.delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)', strokeWidth: 1.5 } : {})}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PerformanceTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  const { month, year, spent, budget, delta, isCurrent } = data;
  return (
    <div className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-xs shadow-lg">
      <p className="font-medium text-[var(--color-fg)] mb-1.5">
        {month} {year}{isCurrent ? ' (so far)' : ''}
      </p>
      <div className="space-y-1 tabular-nums">
        <p className="text-[var(--color-muted)]">
          Spent: <span className="text-[var(--color-fg)] font-medium">{formatCurrency(spent)}</span>
        </p>
        <p className="text-[var(--color-muted)]">
          Budget: <span className="text-[var(--color-fg)] font-medium">{formatCurrency(budget)}</span>
        </p>
        <p className={delta >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}>
          {delta >= 0 ? `${formatCurrency(delta)} under` : `${formatCurrency(Math.abs(delta))} over`}
        </p>
      </div>
    </div>
  );
}

// ─── Burn-down chart ──────────────────────────────────────────────────
// Cumulative spend across all budgeted categories this month, plotted
// against an even-burn pace line. Uses the shared LineChart component
// so it matches the look and feel of NetWorthCard / dashboard charts.
// The header shows live numbers that update on hover, NetWorth-style.

function BurnDownChart({
  series,
  totalAllocated,
  income,
  hasIncome,
  allocatedPct,
  unallocated,
  overAllocated,
  pace,
}) {
  const [activeIndex, setActiveIndex] = useState(null);

  const daysInMonth = pace?.daysInMonth || 30;
  const today = pace?.day || daysInMonth;

  // Build a full-month daily series: actual cumulative spend up to today,
  // plus the even-burn pace line all the way to the end of the month.
  // Future-day actuals are `null` so the line stops at today — but the
  // pace line continues to totalAllocated on day `daysInMonth`, pinning
  // the chart's max value and pushing the higher line to the top edge.
  const chartData = useMemo(() => {
    if (!totalAllocated || totalAllocated <= 0 || daysInMonth <= 0) return [];
    const burnByDay = new Map();
    series.forEach((p) => burnByDay.set(p.day, p.cumulative));
    const out = [];
    let running = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (burnByDay.has(day)) running = burnByDay.get(day);
      out.push({
        day,
        dayLabel: `Day ${day}`,
        value: day <= today ? Number(running.toFixed(2)) : null,
        pace: Number(((day / daysInMonth) * totalAllocated).toFixed(2)),
      });
    }
    return out;
  }, [series, totalAllocated, daysInMonth, today]);

  // "Current" (non-hover) state: spending as of today.
  const todayPoint = chartData.find((p) => p.day === today);
  const currentSpent = todayPoint?.value ?? 0;

  const hovered =
    activeIndex !== null && chartData[activeIndex] ? chartData[activeIndex] : null;

  // When hovering past today, the actual value is null — keep showing the
  // current total instead of jumping to 0.
  const displaySpent =
    hovered && hovered.value != null ? hovered.value : currentSpent;
  const displayPace = hovered?.pace ?? todayPoint?.pace ?? 0;
  const displayDay = hovered?.day ?? today;
  const displayDelta = displaySpent - displayPace;
  const isOverPace = displayDelta > 0;
  const isOverBudget = currentSpent > totalAllocated;

  // y-axis: clamp tight to the highest line so the visible max IS the
  // top of the chart. Tiny 2% headroom so the line doesn't clip.
  const maxSpent = useMemo(
    () =>
      chartData.reduce((m, p) => (p.value != null && p.value > m ? p.value : m), 0),
    [chartData]
  );
  const yMax = Math.max(totalAllocated, maxSpent) * 1.02;

  const lineColor = isOverBudget
    ? 'var(--color-danger)'
    : isOverPace
      ? '#f59e0b'
      : 'var(--color-success)';

  // Build a date label for the displayed day (e.g. "April 11, 2026").
  const monthLabel = useMemo(() => {
    const d = new Date();
    d.setDate(displayDay);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [displayDay]);

  const formatYAxis = (v) => {
    if (v >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    return `$${Math.round(v)}`;
  };

  const handleMouseMove = (_data, index) => setActiveIndex(index);
  const handleMouseLeave = () => setActiveIndex(null);

  // Empty state — no budgets yet
  if (!totalAllocated || totalAllocated <= 0) {
    return (
      <div onMouseLeave={handleMouseLeave}>
        <div className="mb-4">
          <div className="card-header mb-1">Spent this month</div>
          <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight">
            $0
          </div>
          <div className="text-xs text-[var(--color-muted)] mt-0.5">
            No budgets yet
          </div>
        </div>
        <div className="pt-4 pb-2 h-[200px] flex items-center justify-center text-sm text-[var(--color-muted)]">
          Create a budget to start tracking
        </div>
      </div>
    );
  }

  return (
    <div onMouseLeave={handleMouseLeave}>
      {/* Header — NetWorthCard pattern: title, big number, change line, date */}
      <div className="mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="card-header mb-1">Spent this month</div>
            <div className="flex flex-col">
              <div className="text-2xl font-medium text-[var(--color-fg)] tracking-tight tabular-nums">
                {formatCurrency(displaySpent)}
              </div>
              <div
                className={`text-xs font-medium mt-0.5 tabular-nums ${
                  isOverBudget
                    ? 'text-[var(--color-danger)]'
                    : isOverPace
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                }`}
              >
                {isOverBudget
                  ? `${formatCurrency(displaySpent - totalAllocated)} over budget`
                  : isOverPace
                    ? `${formatCurrency(displayDelta)} ahead of pace`
                    : `${formatCurrency(Math.abs(displayDelta))} under pace`}
                <span className="text-[var(--color-muted)] font-normal">
                  {' '}· of {formatCurrency(totalAllocated)} budgeted
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-[var(--color-muted)] font-medium">
              {monthLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Chart — uses shared LineChart for consistency with NetWorthCard */}
      <div className="pt-4 pb-2">
        <div
          className="w-full focus:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none relative"
          tabIndex={-1}
          style={{ outline: 'none', height: '200px' }}
        >
          <LineChart
            data={chartData}
            width="100%"
            height={200}
            margin={{ top: 10, right: 0, bottom: 10, left: 0 }}
            curveType="monotone"
            xAxisDataKey="dayLabel"
            yAxisDomain={[0, yMax]}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            lines={[
              {
                dataKey: 'value',
                strokeColor: lineColor,
                strokeWidth: 2,
                showArea: true,
                areaOpacity: 0.18,
                gradientId: 'burnActualGradient',
              },
              {
                dataKey: 'pace',
                strokeColor: 'var(--color-muted)',
                strokeWidth: 1.25,
                strokeOpacity: 0.55,
                strokeDasharray: '4 4',
                showArea: false,
                gradientId: 'burnPaceGradient',
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}


// ─── Suggestion row (flat, matches BudgetRow styling) ─────────────────

function SuggestionRow({
  suggestion,
  income,
  hasIncome,
  adding,
  disabled,
  onAdd,
  isLast,
}) {
  const color = suggestion.hex_color || '#71717a';
  const iconName = suggestion.icon_name;
  const iconLib = suggestion.icon_lib;
  const avg = Number(suggestion.monthly_avg || 0);
  const pctOfIncome = hasIncome && avg > 0 ? (avg / income) * 100 : 0;

  return (
    <div
      className={`
        group flex items-center gap-4 py-4 px-2 -mx-2 rounded-lg transition-colors
        hover:bg-[var(--color-card-highlight)]
        ${!isLast ? 'border-b border-[color-mix(in_oklab,var(--color-fg),transparent_93%)]' : ''}
      `}
    >
      {/* Icon pill — solid color, white glyph (matches BudgetRow) */}
      <CategoryIcon iconName={iconName} iconLib={iconLib} color={color} size={32} />

      {/* Label + avg */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--color-fg)] truncate">
          {suggestion.label}
        </p>
        <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
          {formatCurrency(avg)}/mo avg
          {hasIncome && pctOfIncome > 0 && ` · ${pctOfIncome.toFixed(0)}% of income`}
        </p>
      </div>

      {/* Add action */}
      <button
        type="button"
        onClick={onAdd}
        disabled={adding || disabled}
        className="inline-flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-card-highlight)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap flex-shrink-0"
      >
        {adding ? (
          'Adding…'
        ) : (
          <>
            <LuPlus className="w-3 h-3" />
            Add budget
          </>
        )}
      </button>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function BudgetsSkeleton() {
  return (
    <div className="space-y-10 animate-pulse">
      <div>
        <div className="h-3 w-32 bg-[var(--color-border)] rounded mb-4" />
        <div className="h-10 w-48 bg-[var(--color-border)] rounded mb-6" />
        <div className="h-1.5 w-full bg-[var(--color-border)] rounded-full" />
      </div>
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-4">
            <div className="w-9 h-9 rounded-full bg-[var(--color-border)]" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-[var(--color-border)] rounded mb-1.5" />
              <div className="h-3 w-20 bg-[var(--color-border)] rounded" />
            </div>
            <div className="h-1 w-24 bg-[var(--color-border)] rounded-full" />
            <div className="h-4 w-16 bg-[var(--color-border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
