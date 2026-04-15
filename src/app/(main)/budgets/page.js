"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { useUser } from '../../../components/providers/UserProvider';
import PageContainer from '../../../components/layout/PageContainer';
import CreateBudgetOverlay from '../../../components/budgets/CreateBudgetOverlay';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import LineChart from '../../../components/ui/LineChart';
import UpgradeOverlay from '../../../components/UpgradeOverlay';
import { EmptyState } from '@slate-ui/react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import { formatCurrency } from '../../../lib/formatCurrency';

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
  // { [budgetKey]: [{ spending, monthName, year, monthNumber }, ...] }
  // budgetKey = `group:{id}` or `category:{id}` to match the history API.
  const [historyByBudget, setHistoryByBudget] = useState({});

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fire one category-history request per budget in parallel so each row
  // can show a 6-month utilization strip. Keyed by budget id so it
  // survives budget add/remove without mismatching.
  const fetchHistoryForBudgets = async (rows) => {
    if (!rows || rows.length === 0) {
      setHistoryByBudget({});
      return;
    }
    try {
      const results = await Promise.all(
        rows.map(async (b) => {
          const param = b.category_group_id
            ? `categoryGroupId=${b.category_group_id}`
            : `categoryId=${b.category_id}`;
          try {
            const res = await fetch(
              `/api/transactions/category-history?${param}&months=6`
            );
            const json = await res.json();
            return [b.id, Array.isArray(json?.data) ? json.data : []];
          } catch {
            return [b.id, []];
          }
        })
      );
      setHistoryByBudget(Object.fromEntries(results));
    } catch (e) {
      console.error(e);
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

  // Refetch per-budget history whenever the set of budgets changes.
  useEffect(() => {
    fetchHistoryForBudgets(budgets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets.map((b) => b.id).join(',')]);

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
        <div className="space-y-10">
          {/* ── Hero: chart 2/3 + side panel 1/3 ────────────────────── */}
          <section className="flex flex-col lg:flex-row gap-8 lg:gap-10">
            {/* Burn-down chart — visual hero, NetWorthCard style */}
            <div className="lg:w-2/3">
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
            </div>

            {/* Side panel: condensed summary + suggestions */}
            <div className="lg:w-1/3 flex flex-col gap-8">
              {/* Compact stats stack */}
              <div>
                <h2 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-4">
                  This month
                </h2>
                <dl className="space-y-3 text-xs">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--color-muted)]">Budgeted</dt>
                    <dd className="text-[var(--color-fg)] tabular-nums font-medium">
                      {formatCurrency(totalAllocated)}
                      {hasIncome && (
                        <span className="text-[var(--color-muted)] font-normal">
                          {' '}/ {formatCurrency(income)}
                        </span>
                      )}
                    </dd>
                  </div>
                  {hasIncome && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">
                        {overAllocated > 0 ? 'Over by' : 'Unallocated'}
                      </dt>
                      <dd
                        className="tabular-nums font-medium"
                        style={{
                          color:
                            overAllocated > 0
                              ? 'var(--color-danger)'
                              : 'var(--color-fg)',
                        }}
                      >
                        {formatCurrency(overAllocated > 0 ? overAllocated : unallocated)}
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
                  {pace && (
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="text-[var(--color-muted)]">Month progress</dt>
                      <dd className="text-[var(--color-fg)] tabular-nums font-medium">
                        Day {pace.day} / {pace.daysInMonth}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Suggestions panel */}
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

          {/* ── Budgets list ───────────────────────────────────────── */}
          <section className="pt-4">
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
                  history={historyByBudget[b.id]}
                  selectMode={selectMode}
                  selected={selectedIds.has(b.id)}
                  onToggleSelect={() => toggleSelect(b.id)}
                  onDelete={() => requestDelete([b.id])}
                  isLast={i === sortedBudgets.length - 1}
                />
              ))}
            </div>
          </section>
        </div>
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

function getIcon(b) {
  const isGroup = !!b.category_groups;
  const iconName = isGroup
    ? b.category_groups?.icon_name
    : b.system_categories?.icon_name;
  return iconName && Icons[iconName] ? Icons[iconName] : Icons.Wallet;
}

// ─── Budget row ───────────────────────────────────────────────────────

function BudgetRow({
  budget,
  income,
  hasIncome,
  pace,
  history,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
  isLast,
}) {
  const Icon = getIcon(budget);
  const color = getColor(budget);
  const label = getLabel(budget);
  const amount = Number(budget.amount || 0);
  const spent = Number(budget.spent || 0);
  const spendPct = Number(budget.percentage || 0);
  const hasSpending = spent > 0 || spendPct > 0;
  const allocPct = hasIncome && amount > 0 ? (amount / income) * 100 : 0;

  // Pacing. Expected spend by today = amount * (day / daysInMonth).
  // Over-pace means spendPct > expectedPct.
  const expectedPct = pace ? pace.fraction * 100 : null;
  const expectedAmount = pace ? amount * pace.fraction : null;
  const paceDelta = expectedAmount != null ? spent - expectedAmount : null;
  const overPace =
    expectedPct != null && spendPct > expectedPct + 2 && spendPct < 100;
  const underPace =
    expectedPct != null && hasSpending && spendPct < expectedPct - 2;

  let progressColor = color;
  if (spendPct >= 100) progressColor = 'var(--color-danger)';
  else if (spendPct >= 85 || overPace) progressColor = '#f59e0b';

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
      {/* Checkbox in select mode */}
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

      {/* Icon pill */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `color-mix(in oklab, ${color}, transparent 85%)`,
          color,
        }}
      >
        <Icon size={15} />
      </div>

      {/* Label + sublabel */}
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

      {/* History strip — last 6 months of utilization against the
          current budget amount. Hidden on narrow screens. */}
      <div className="hidden md:block flex-shrink-0">
        <HistoryStrip history={history} amount={amount} color={color} />
      </div>

      {/* Right side: spent-of-budget + progress + remaining */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0 w-32 sm:w-44">
        <p className="text-sm tabular-nums whitespace-nowrap">
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

        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
            {hasSpending && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(spendPct, 100)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: progressColor }}
              />
            )}
            {/* Pace tick — where we should be today */}
            {expectedPct != null && expectedPct > 0 && expectedPct < 100 && (
              <div
                className="absolute top-[-2px] bottom-[-2px] w-[1.5px] bg-[var(--color-fg)] opacity-60"
                style={{ left: `${expectedPct}%` }}
                title={`Day ${pace.day} of ${pace.daysInMonth}`}
              />
            )}
          </div>
          <span className="text-[10px] text-[var(--color-muted)] tabular-nums whitespace-nowrap w-8 text-right">
            {hasSpending ? `${spendPct.toFixed(0)}%` : '0%'}
          </span>
        </div>

        <p className="text-[10px] text-[var(--color-muted)] tabular-nums whitespace-nowrap">
          {spendPct >= 100
            ? `${formatCurrency(spent - amount)} over`
            : `${formatCurrency(Math.max(0, amount - spent))} left`}
        </p>
      </div>

      {/* Delete button (hidden in select mode) */}
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

// ─── History strip ────────────────────────────────────────────────────
// Last 6 months of this category's spending, measured against the
// current budget amount. Each bar: height = utilization%, color = status
// (green < 85%, amber 85–100%, red > 100%). Current month is omitted so
// it doesn't compete with the live progress bar on the right.

function HistoryStrip({ history, amount }) {
  // Always render the container (fixed width) so row layout doesn't
  // shift while the fetch is in flight.
  const width = 84; // px — 6 bars * 14px pitch
  const height = 28;

  if (!Array.isArray(history) || history.length === 0 || !amount) {
    return (
      <div
        className="flex items-end gap-[3px]"
        style={{ width, height }}
        aria-hidden
      >
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-[1.5px] bg-[var(--color-border)] opacity-40"
            style={{ height: 4 }}
          />
        ))}
      </div>
    );
  }

  // category-history returns newest-first. Drop the current month, keep
  // the most recent 6 complete months, then reverse so bars read L→R
  // oldest→newest.
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
  const completed = history.filter(
    (m) => `${m.year}-${m.monthNumber}` !== currentKey
  );
  const recent = completed.slice(0, 6).reverse();

  // Pad out to 6 slots so the strip has a consistent width even if the
  // user only has a few months of data.
  const slots = [...Array(6)].map((_, i) => {
    const offset = 6 - recent.length;
    return i < offset ? null : recent[i - offset];
  });

  return (
    <div
      className="flex items-end gap-[3px]"
      style={{ width, height }}
      title="Last 6 months vs current budget"
    >
      {slots.map((m, i) => {
        if (!m) {
          return (
            <div
              key={i}
              className="flex-1 rounded-[1.5px] bg-[var(--color-border)] opacity-30"
              style={{ height: 2 }}
            />
          );
        }
        const spent = Number(m.spending || 0);
        const util = amount > 0 ? spent / amount : 0;
        const h = Math.max(2, Math.min(1, util) * height);
        let bg = 'var(--color-success)';
        if (util >= 1) bg = 'var(--color-danger)';
        else if (util >= 0.85) bg = '#f59e0b';
        return (
          <div
            key={i}
            className="flex-1 rounded-[1.5px]"
            style={{ height: h, backgroundColor: bg, opacity: 0.85 }}
            title={`${m.monthName} ${m.year}: ${formatCurrency(spent)} (${Math.round(
              util * 100
            )}%)`}
          />
        );
      })}
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

  // Build dense daily series from day 1 to today: cumulative spend +
  // pace baseline at each day. Padding flat between spending events
  // gives the line a clean step-like shape under the monotone curve.
  const chartData = useMemo(() => {
    if (!totalAllocated || totalAllocated <= 0 || daysInMonth <= 0) return [];
    const burnByDay = new Map();
    series.forEach((p) => burnByDay.set(p.day, p.cumulative));
    const out = [];
    let running = 0;
    for (let day = 1; day <= today; day++) {
      if (burnByDay.has(day)) running = burnByDay.get(day);
      out.push({
        day,
        dayLabel: `Day ${day}`,
        value: Number(running.toFixed(2)),
        pace: Number(((day / daysInMonth) * totalAllocated).toFixed(2)),
      });
    }
    return out;
  }, [series, totalAllocated, daysInMonth, today]);

  const lastPoint = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const hovered =
    activeIndex !== null && chartData[activeIndex] ? chartData[activeIndex] : null;
  const display = hovered || lastPoint;
  const displaySpent = display?.value || 0;
  const displayPace = display?.pace || 0;
  const displayDay = display?.day || today;
  const displayDelta = displaySpent - displayPace;
  const isOverPace = displayDelta > 0;
  const isOverBudget = displaySpent > totalAllocated;

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
            yAxisDomain={[0, totalAllocated * 1.1]}
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
  const Icon = iconName && Icons[iconName] ? Icons[iconName] : Icons.Wallet;
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
      {/* Icon pill (muted compared to real budget rows) */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 opacity-80"
        style={{
          backgroundColor: `color-mix(in oklab, ${color}, transparent 88%)`,
          color,
        }}
      >
        <Icon size={15} />
      </div>

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
