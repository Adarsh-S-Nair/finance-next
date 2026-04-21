"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useUser } from '../../../components/providers/UserProvider';
import PageContainer from '../../../components/layout/PageContainer';
import CreateBudgetOverlay from '../../../components/budgets/CreateBudgetOverlay';
import DynamicIcon from '../../../components/DynamicIcon';
import ConfirmOverlay from '../../../components/ui/ConfirmOverlay';
import LineChart from '../../../components/ui/LineChart';
import UpgradeOverlay from '../../../components/UpgradeOverlay';
import { FiTag } from 'react-icons/fi';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import { formatCurrency } from '../../../lib/formatCurrency';
import { Button, EmptyState } from "@zervo/ui";

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

  // Delete state (single-row, triggered by hover trash)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
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

  // Used for suggestion cards. Same endpoint CreateBudgetOverlay uses —
  // gives us typical monthly spend per group so we can suggest budgets
  // for the top unbudgeted categories.
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

  const requestDelete = (id) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/budgets?id=${pendingDeleteId}`, { method: 'DELETE' });
      await fetchBudgets();
      setConfirmOpen(false);
      setPendingDeleteId(null);
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

  const hasBudgets = budgets.length > 0;

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
    <PageContainer title="Budgets">
      {loading ? (
        <BudgetsSkeleton />
      ) : (
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          {/* Main panel — burn-down chart + budgets list */}
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

            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-lg font-medium text-[var(--color-fg)]">Your budgets</h2>
                  {hasIncome && (
                    <span className="text-xs text-[var(--color-muted)] tabular-nums">
                      {formatCurrency(totalAllocated)} / {formatCurrency(income)}
                      {overAllocated > 0 && (
                        <span className="text-[var(--color-danger)]">
                          {' '}· {formatCurrency(overAllocated)} over
                        </span>
                      )}
                    </span>
                  )}
                </div>
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
              <div className="flex flex-col">
                {sortedBudgets.map((b, i) => (
                  <BudgetRow
                    key={b.id}
                    budget={b}
                    income={income}
                    hasIncome={hasIncome}
                    pace={pace}
                    onDelete={() => requestDelete(b.id)}
                    isLast={i === sortedBudgets.length - 1}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Side panel — month progress + suggestions */}
          <div className="lg:w-1/3 flex flex-col gap-10">
            <MonthProgress
              pace={pace}
              totalAllocated={totalAllocated}
              burnSeries={burnSeries}
              budgets={sortedBudgets}
            />

            {suggestions.length > 0 && (
              <div id="budget-suggestions">
                <h2 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-4">
                  Quick add
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

      <ConfirmOverlay
        isOpen={confirmOpen}
        variant="danger"
        title="Delete budget?"
        description="This budget will be permanently removed. Your transactions and spending history will not be affected."
        confirmLabel="Delete"
        busy={deleting}
        onCancel={() => {
          if (deleting) return;
          setConfirmOpen(false);
          setPendingDeleteId(null);
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

// ─── Budget row ───────────────────────────────────────────────────────

function BudgetRow({ budget, income, hasIncome, pace, onDelete, isLast }) {
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
  const overBudget = spendPct >= 100;

  // Inline progress fill: category-colored bar behind the row that grows
  // with spend. Flips to danger when over budget, amber when over pace.
  // Opacity is bumped up from the original v1 pass for visibility.
  const fillPct = Math.min(100, Math.max(0, spendPct));
  const fillColor = overBudget
    ? 'var(--color-danger)'
    : overPace
      ? '#f59e0b'
      : color;
  const fillOpacity = overBudget ? 0.22 : overPace ? 0.20 : 0.16;

  return (
    <div
      className={`
        group relative isolate flex items-center gap-4 py-4 px-3 -mx-3 rounded-lg overflow-hidden
        ${!isLast ? 'border-b border-[color-mix(in_oklab,var(--color-fg),transparent_93%)]' : ''}
        hover:bg-[var(--color-card-highlight)]
      `}
    >
      {/* Progress fill — sits behind content, grows with spend */}
      {hasSpending && fillPct > 0 && (
        <div
          aria-hidden
          className="absolute inset-y-0 left-0 -z-10 pointer-events-none"
          style={{
            width: `${fillPct}%`,
            backgroundColor: fillColor,
            opacity: fillOpacity,
          }}
        />
      )}

      <CategoryIcon iconName={iconName} iconLib={iconLib} color={color} size={36} />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--color-fg)] truncate">{label}</p>
        <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
          {hasIncome && `${allocPct.toFixed(0)}% of income`}
          {overBudget && (
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
              color: overBudget ? 'var(--color-danger)' : 'var(--color-fg)',
            }}
          >
            {formatCurrency(spent)}
          </span>
          <span className="text-[var(--color-muted)]"> / {formatCurrency(amount)}</span>
        </p>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--color-muted)] hover:text-[var(--color-danger)] rounded"
        title="Delete budget"
        aria-label={`Delete ${label} budget`}
      >
        <LuTrash2 size={14} />
      </button>
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


// ─── Month Progress (side-panel component) ────────────────────────────
// Visual pace indicator: horizontal bar showing how much of the month has
// elapsed vs. how much of the budget has been spent. Plus a compact stat
// showing whether you're ahead or behind.

function MonthProgress({ pace, totalAllocated, burnSeries, budgets }) {
  if (!pace) return null;

  // Cumulative spend to date (last point in burnSeries)
  const currentSpent =
    Array.isArray(burnSeries) && burnSeries.length > 0
      ? Number(burnSeries[burnSeries.length - 1]?.cumulative || 0)
      : 0;

  const pacePct = pace.fraction * 100;
  const spendPct =
    totalAllocated > 0 ? Math.min(100, (currentSpent / totalAllocated) * 100) : 0;
  const expectedSpent = totalAllocated * pace.fraction;
  const delta = currentSpent - expectedSpent;
  const isOverPace = delta > 1;
  const isOverBudget = currentSpent > totalAllocated;

  // Count budgets in trouble — over budget or meaningfully ahead of pace
  const trouble = budgets.reduce(
    (acc, b) => {
      const sp = Number(b.percentage || 0);
      const ep = pacePct;
      if (sp >= 100) acc.over += 1;
      else if (sp > ep + 2) acc.ahead += 1;
      return acc;
    },
    { over: 0, ahead: 0 }
  );

  const deltaColor = isOverBudget
    ? 'text-[var(--color-danger)]'
    : isOverPace
      ? 'text-amber-500'
      : 'text-emerald-500';

  const deltaLabel = isOverBudget
    ? `${formatCurrency(currentSpent - totalAllocated)} over budget`
    : isOverPace
      ? `${formatCurrency(delta)} ahead of pace`
      : currentSpent > 0
        ? `${formatCurrency(Math.abs(delta))} under pace`
        : 'Nothing spent yet';

  return (
    <div>
      <div className="card-header mb-5">Month pace</div>

      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-sm font-medium text-[var(--color-fg)]">
          Day {pace.day} of {pace.daysInMonth}
        </span>
        <span className="text-xs text-[var(--color-muted)] tabular-nums">
          {pacePct.toFixed(0)}% elapsed
        </span>
      </div>

      {/* Stacked bars: month pace (reference) + actual spend */}
      <div className="space-y-2.5 mb-6">
        <div>
          <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-muted)] opacity-50"
              style={{ width: `${pacePct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)] tabular-nums">
            <span>Month</span>
            <span>{formatCurrency(expectedSpent)} expected</span>
          </div>
        </div>
        <div>
          <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${spendPct}%`,
                backgroundColor: isOverBudget
                  ? 'var(--color-danger)'
                  : isOverPace
                    ? '#f59e0b'
                    : 'var(--color-success)',
              }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[var(--color-muted)] tabular-nums">
            <span>Spent</span>
            <span>
              {formatCurrency(currentSpent)} of {formatCurrency(totalAllocated)}
            </span>
          </div>
        </div>
      </div>

      <div className={`text-sm font-medium tabular-nums ${deltaColor}`}>
        {deltaLabel}
      </div>

      {(trouble.over > 0 || trouble.ahead > 0) && (
        <div className="mt-4 pt-4 border-t border-[color-mix(in_oklab,var(--color-fg),transparent_93%)] space-y-2">
          {trouble.over > 0 && (
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--color-muted)]">Over budget</span>
              <span className="text-[var(--color-danger)] font-medium tabular-nums">
                {trouble.over} {trouble.over === 1 ? 'category' : 'categories'}
              </span>
            </div>
          )}
          {trouble.ahead > 0 && (
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--color-muted)]">Ahead of pace</span>
              <span className="text-amber-600 dark:text-amber-500 font-medium tabular-nums">
                {trouble.ahead} {trouble.ahead === 1 ? 'category' : 'categories'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Suggestion row (flat, no card border) ────────────────────────────

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
        group flex items-center gap-3 py-3 px-2 -mx-2 rounded-lg
        hover:bg-[var(--color-card-highlight)]
        ${!isLast ? 'border-b border-[color-mix(in_oklab,var(--color-fg),transparent_93%)]' : ''}
      `}
    >
      <CategoryIcon iconName={iconName} iconLib={iconLib} color={color} size={28} />

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-[var(--color-fg)] truncate">
          {suggestion.label}
        </p>
        <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
          {formatCurrency(avg)}/mo avg
          {hasIncome && pctOfIncome > 0 && ` · ${pctOfIncome.toFixed(0)}%`}
        </p>
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={adding || disabled}
        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        title={`Add ${suggestion.label} budget`}
        aria-label={`Add ${suggestion.label} budget`}
      >
        {adding ? <span className="text-[10px]">…</span> : <LuPlus className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────
// Mirrors the real layout: burn-down chart + budgets list (2/3) on the
// left, month-progress + suggestions (1/3) on the right.

function BudgetsSkeleton() {
  const bar = "bg-[var(--color-border)] rounded";
  return (
    <section className="flex flex-col lg:flex-row gap-8 lg:gap-10 animate-pulse">
      {/* Main panel */}
      <div className="lg:w-2/3 flex flex-col gap-10">
        {/* Burn-down chart */}
        <div>
          <div className={`h-3 w-32 ${bar} mb-2`} />
          <div className={`h-8 w-44 ${bar} mb-2`} />
          <div className={`h-3 w-52 ${bar} mb-6`} />
          <div className={`h-[200px] w-full ${bar}`} />
        </div>

        {/* Budgets list */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className={`h-5 w-32 ${bar}`} />
            <div className={`h-8 w-28 ${bar} rounded-full`} />
          </div>
          <div>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 py-4 px-3 -mx-3 border-b border-[color-mix(in_oklab,var(--color-fg),transparent_93%)]"
              >
                <div className={`h-9 w-9 rounded-full ${bar}`} />
                <div className="flex-1">
                  <div className={`h-3 w-32 ${bar} mb-2`} />
                  <div className={`h-3 w-20 ${bar}`} />
                </div>
                <div className={`h-4 w-24 ${bar}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Side panel */}
      <div className="lg:w-1/3 flex flex-col gap-10">
        {/* Month progress */}
        <div>
          <div className={`h-3 w-24 ${bar} mb-5`} />
          <div className="flex justify-between mb-3">
            <div className={`h-4 w-28 ${bar}`} />
            <div className={`h-3 w-20 ${bar}`} />
          </div>
          <div className={`h-1.5 w-full ${bar} mb-4`} />
          <div className={`h-1.5 w-full ${bar} mb-4`} />
          <div className={`h-4 w-40 ${bar}`} />
        </div>

        {/* Suggestions */}
        <div>
          <div className={`h-3 w-20 ${bar} mb-4`} />
          <div>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-3 px-2 -mx-2 border-b border-[color-mix(in_oklab,var(--color-fg),transparent_93%)]"
              >
                <div className={`h-7 w-7 rounded-full ${bar}`} />
                <div className="flex-1">
                  <div className={`h-3 w-24 ${bar} mb-1.5`} />
                  <div className={`h-3 w-16 ${bar}`} />
                </div>
                <div className={`h-7 w-7 rounded-full ${bar}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
