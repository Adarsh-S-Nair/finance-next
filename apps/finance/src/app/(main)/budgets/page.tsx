"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../components/providers/UserProvider';
import { useAuthedQuery } from '../../../lib/api/useAuthedQuery';
import PageContainer from '../../../components/layout/PageContainer';
import CreateBudgetOverlay from '../../../components/budgets/CreateBudgetOverlay';
import IncomeEditor from '../../../components/budgets/IncomeEditor';
import DynamicIcon from '../../../components/DynamicIcon';
import UpgradeOverlay from '../../../components/UpgradeOverlay';
import { FiTag } from 'react-icons/fi';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import { formatCurrency } from '../../../lib/formatCurrency';
import { isBudgetOver } from '../../../lib/budget';
import { Button, EmptyState } from "@zervo/ui";
import { ConfirmOverlay, LineChart } from "@zervo/ui";

// ─── Types ────────────────────────────────────────────────────────────

interface BudgetRecord {
  id: string;
  amount: number | string;
  spent?: number;
  percentage?: number;
  category_groups?: {
    name?: string;
    icon_name?: string | null;
    icon_lib?: string | null;
    hex_color?: string | null;
  } | null;
  system_categories?: {
    label?: string;
    icon_name?: string | null;
    icon_lib?: string | null;
    hex_color?: string | null;
  } | null;
  category_id?: string | null;
  category_group_id?: string | null;
}

interface IncomeMonth {
  earning?: number | string;
  spending?: number | string;
  isComplete?: boolean;
  [key: string]: unknown;
}

interface CategoryStat {
  id: string;
  label: string;
  hex_color?: string | null;
  icon_name?: string | null;
  icon_lib?: string | null;
  total_spent?: number;
  monthly_avg?: number;
}

interface BurnSeriesPoint {
  day: number;
  spent: number;
  cumulative: number;
}

interface PaceInfo {
  day: number;
  daysInMonth: number;
  fraction: number;
}

export default function BudgetsPage() {
  const { user, profile, isPro, refreshProfile } = useUser();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [addingSuggestionId, setAddingSuggestionId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // All three of the page's fetches now live in react-query, so
  // navigating away and back paints the page from cache instead of
  // showing the skeleton on every visit.
  const { data: budgetsPayload, isLoading: budgetsLoading } = useAuthedQuery<{
    data?: BudgetRecord[];
    burn?: BurnSeriesPoint[];
  }>(['budgets:list', user?.id], user?.id ? '/api/budgets' : null);
  const budgets = useMemo(() => budgetsPayload?.data ?? [], [budgetsPayload]);
  const burnSeries = useMemo(
    () => (Array.isArray(budgetsPayload?.burn) ? budgetsPayload.burn : []),
    [budgetsPayload],
  );
  const loading = !!user?.id && budgetsLoading && !budgetsPayload;

  const { data: incomePayload } = useAuthedQuery<{ data?: IncomeMonth[] }>(
    ['budgets:income', user?.id],
    user?.id ? '/api/transactions/spending-earning?months=6' : null,
  );
  const { fallbackIncome, incomeMonths } = useMemo(() => {
    const months = Array.isArray(incomePayload?.data) ? (incomePayload!.data as IncomeMonth[]) : [];
    const completed = months.filter((m) => m.isComplete);
    const sample = completed.length > 0 ? completed : months;
    const nonZero = sample.filter((m) => Number(m.earning || 0) > 0);
    const source = nonZero.length > 0 ? nonZero : sample;
    const totalEarning = source.reduce((sum, m) => sum + Number(m.earning || 0), 0);
    const avg = source.length > 0 ? totalEarning / source.length : 0;
    return { fallbackIncome: avg, incomeMonths: sample };
  }, [incomePayload]);

  const { data: categoryStatsPayload } = useAuthedQuery<{ categories?: CategoryStat[] }>(
    ['budgets:category-stats', user?.id],
    user?.id ? '/api/transactions/spending-by-category?days=120&forBudget=true&groupBy=group' : null,
  );
  const categoryStats = useMemo(
    () =>
      (categoryStatsPayload?.categories ?? []).filter(
        (c) => (c.total_spent ?? 0) > 0 && c.label !== 'Account Transfer',
      ),
    [categoryStatsPayload],
  );

  // Helpers callers below still expect — refresh from cache after
  // mutating budgets, recompute income, etc.
  const refetchBudgets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['budgets:list', user?.id] });
  }, [queryClient, user?.id]);
  const refetchCategoryStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['budgets:category-stats', user?.id] });
  }, [queryClient, user?.id]);

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
  const overAllocated = Math.max(0, totalAllocated - income);

  const pace: PaceInfo = useMemo(() => {
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
      fraction: Math.min(1, day / daysInMonth),
    };
  }, []);

  const suggestions = useMemo<CategoryStat[]>(() => {
    if (!categoryStats.length) return [];
    const budgetedGroupIds = new Set(
      budgets.map((b) => b.category_group_id).filter((id): id is string => Boolean(id))
    );
    return categoryStats
      .filter((c) => !budgetedGroupIds.has(c.id))
      .filter((c) => Number(c.monthly_avg || 0) > 0)
      .sort((a, b) => Number(b.monthly_avg || 0) - Number(a.monthly_avg || 0))
      .slice(0, 4);
  }, [categoryStats, budgets]);

  const requestDelete = (id: string) => {
    setPendingDeleteId(id);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/budgets?id=${pendingDeleteId}`, { method: 'DELETE' });
      refetchBudgets();
      setConfirmOpen(false);
      setPendingDeleteId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  };

  const handleBudgetCreated = async () => {
    refetchBudgets();
    refetchCategoryStats();
    await refreshProfile?.();
  };

  const handleQuickAddSuggestion = async (suggestion: CategoryStat) => {
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
      refetchBudgets();
      refetchCategoryStats();
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
          incomeMonths={incomeMonths as never}
          existingBudgets={budgets as never}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Budgets">
      {loading ? (
        <BudgetsSkeleton />
      ) : (
        <section className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <div className="lg:w-2/3 flex flex-col gap-10">
            <div className="-mb-4">
              <IncomeEditor
                savedIncome={savedIncome}
                fallbackIncome={Number(fallbackIncome || 0)}
                onChanged={async () => {
                  await refreshProfile?.();
                }}
              />
            </div>
            <BurnDownChart
              series={burnSeries}
              totalAllocated={totalAllocated}
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
        incomeMonths={incomeMonths as never}
        existingBudgets={budgets as never}
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

function getColor(b: BudgetRecord): string {
  const isGroup = !!b.category_groups;
  if (isGroup) return b.category_groups?.hex_color || '#71717a';
  return b.system_categories?.hex_color || '#71717a';
}

function getLabel(b: BudgetRecord): string {
  const isGroup = !!b.category_groups;
  return isGroup
    ? b.category_groups?.name ?? 'Unknown'
    : b.system_categories?.label || 'Unknown';
}

function getIconMeta(b: BudgetRecord): { iconName: string | null; iconLib: string | null } {
  const isGroup = !!b.category_groups;
  const src = isGroup ? b.category_groups : b.system_categories;
  return {
    iconName: src?.icon_name || null,
    iconLib: src?.icon_lib || null,
  };
}

interface CategoryIconProps {
  iconName: string | null;
  iconLib: string | null;
  color: string;
  size?: number;
}

function CategoryIcon({ iconName, iconLib, color, size = 36 }: CategoryIconProps) {
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

interface BudgetRowProps {
  budget: BudgetRecord;
  income: number;
  hasIncome: boolean;
  pace: PaceInfo;
  onDelete: () => void;
  isLast: boolean;
}

function BudgetRow({ budget, income, hasIncome, pace, onDelete, isLast }: BudgetRowProps) {
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
  const overBudget = isBudgetOver(spent, amount);

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

interface BurnDownChartProps {
  series: BurnSeriesPoint[];
  totalAllocated: number;
  pace: PaceInfo;
}

function BurnDownChart({ series, totalAllocated, pace }: BurnDownChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const daysInMonth = pace?.daysInMonth || 30;
  const today = pace?.day || daysInMonth;

  interface ChartPoint {
    day: number;
    dayLabel: string;
    value: number | null;
    pace: number;
  }

  const chartData = useMemo<ChartPoint[]>(() => {
    if (!totalAllocated || totalAllocated <= 0 || daysInMonth <= 0) return [];
    const burnByDay = new Map<number, number>();
    series.forEach((p) => burnByDay.set(p.day, p.cumulative));
    const out: ChartPoint[] = [];
    let running = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      if (burnByDay.has(day)) running = burnByDay.get(day) ?? running;
      out.push({
        day,
        dayLabel: `Day ${day}`,
        value: day <= today ? Number(running.toFixed(2)) : null,
        pace: Number(((day / daysInMonth) * totalAllocated).toFixed(2)),
      });
    }
    return out;
  }, [series, totalAllocated, daysInMonth, today]);

  const todayPoint = chartData.find((p) => p.day === today);
  const currentSpent = todayPoint?.value ?? 0;

  const hovered =
    activeIndex !== null && chartData[activeIndex] ? chartData[activeIndex] : null;

  const displaySpent =
    hovered && hovered.value != null ? hovered.value : currentSpent;
  const displayPace = hovered?.pace ?? todayPoint?.pace ?? 0;
  const displayDay = hovered?.day ?? today;
  const displayDelta = displaySpent - displayPace;
  const isOverPace = displayDelta > 0;
  const isOverBudget = isBudgetOver(currentSpent, totalAllocated);

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

  const monthLabel = useMemo(() => {
    const d = new Date();
    d.setDate(displayDay);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }, [displayDay]);

  const handleMouseMove = (_data: unknown, index: number) => setActiveIndex(index);
  const handleMouseLeave = () => setActiveIndex(null);

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

      <div className="pt-4 pb-2">
        <div
          className="w-full focus:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none relative"
          tabIndex={-1}
          style={{ outline: 'none', height: '200px' }}
        >
          <LineChart
            data={chartData as never}
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

interface MonthProgressProps {
  pace: PaceInfo;
  totalAllocated: number;
  burnSeries: BurnSeriesPoint[];
  budgets: BudgetRecord[];
}

function MonthProgress({ pace, totalAllocated, burnSeries, budgets }: MonthProgressProps) {
  if (!pace) return null;

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
  const isOverBudget = isBudgetOver(currentSpent, totalAllocated);

  const trouble = budgets.reduce(
    (acc, b) => {
      const spent = Number(b.spent || 0);
      const amount = Number(b.amount || 0);
      const sp = Number(b.percentage || 0);
      const ep = pacePct;
      if (isBudgetOver(spent, amount)) acc.over += 1;
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

interface SuggestionRowProps {
  suggestion: CategoryStat;
  income: number;
  hasIncome: boolean;
  adding: boolean;
  disabled: boolean;
  onAdd: () => void;
  isLast: boolean;
}

function SuggestionRow({
  suggestion,
  income,
  hasIncome,
  adding,
  disabled,
  onAdd,
  isLast,
}: SuggestionRowProps) {
  const color = suggestion.hex_color || '#71717a';
  const iconName = suggestion.icon_name ?? null;
  const iconLib = suggestion.icon_lib ?? null;
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

function BudgetsSkeleton() {
  const bar = "bg-[var(--color-border)] rounded";
  return (
    <section className="flex flex-col lg:flex-row gap-8 lg:gap-10 animate-pulse">
      <div className="lg:w-2/3 flex flex-col gap-10">
        <div>
          <div className={`h-3 w-32 ${bar} mb-2`} />
          <div className={`h-8 w-44 ${bar} mb-2`} />
          <div className={`h-3 w-52 ${bar} mb-6`} />
          <div className={`h-[200px] w-full ${bar}`} />
        </div>

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

      <div className="lg:w-1/3 flex flex-col gap-10">
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
