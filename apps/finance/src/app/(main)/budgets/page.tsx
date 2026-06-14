"use client";

import React, { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useUser } from '../../../components/providers/UserProvider';
import { useAuthedQuery } from '../../../lib/api/useAuthedQuery';
import PageContainer from '../../../components/layout/PageContainer';
import CreateBudgetOverlay from '../../../components/budgets/CreateBudgetOverlay';
import IncomeEditor from '../../../components/budgets/IncomeEditor';
import DynamicIcon from '../../../components/DynamicIcon';
import UpgradeOverlay from '../../../components/UpgradeOverlay';
import { FiTag } from 'react-icons/fi';
import {
  LuPlus,
  LuTrash2,
  LuChevronRight,
  LuTriangleAlert,
  LuTrendingUp,
  LuCircleCheck,
  LuSparkles,
} from 'react-icons/lu';
import { formatCurrency } from '../../../lib/formatCurrency';
import { isBudgetOver } from '../../../lib/budget';
import { Button, EmptyState, SegmentedTabs, CustomDonut } from "@zervo/ui";
import { ConfirmOverlay } from "@zervo/ui";

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
  const [tab, setTab] = useState<'overview' | 'categories'>('overview');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: budgetsPayload, isLoading: budgetsLoading } = useAuthedQuery<{
    data?: BudgetRecord[];
  }>(['budgets:list', user?.id], user?.id ? '/api/budgets' : null);
  const budgets = useMemo(() => budgetsPayload?.data ?? [], [budgetsPayload]);
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

  const refetchBudgets = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['budgets:list', user?.id] });
  }, [queryClient, user?.id]);
  const refetchCategoryStats = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['budgets:category-stats', user?.id] });
  }, [queryClient, user?.id]);

  const savedIncome = Number(profile?.monthly_income || 0);
  const income = savedIncome > 0 ? savedIncome : Number(fallbackIncome || 0);
  const hasIncome = income > 0;

  const sortedBudgets = useMemo(
    () => [...budgets].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0)),
    [budgets],
  );

  const pace: PaceInfo = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return { day, daysInMonth, fraction: Math.min(1, day / daysInMonth) };
  }, []);

  // ── Roll-up metrics ──────────────────────────────────────────────────
  const totalAllocated = useMemo(
    () => budgets.reduce((sum, b) => sum + Number(b.amount || 0), 0),
    [budgets],
  );
  const totalSpent = useMemo(
    () => budgets.reduce((sum, b) => sum + Number(b.spent || 0), 0),
    [budgets],
  );
  const totalRemaining = totalAllocated - totalSpent;
  const spendPct = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
  const overAllocated = Math.max(0, totalAllocated - income);

  // Linear month-end projection from current pace.
  const projectedSpent =
    pace.fraction > 0 ? Math.round(totalSpent / pace.fraction) : totalSpent;
  const projectedRemaining = totalAllocated - projectedSpent;

  const monthLabel = useMemo(
    () => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [],
  );

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
        <>
          {/* Month label + view tabs */}
          <div className="flex items-center justify-between mb-8">
            <div className="text-lg font-medium text-[var(--color-fg)] tracking-tight">
              {monthLabel}
            </div>
            <SegmentedTabs
              value={tab}
              onChange={(v) => setTab(v as 'overview' | 'categories')}
              options={[
                { label: 'Overview', value: 'overview' },
                { label: 'Categories', value: 'categories' },
              ]}
            />
          </div>

          {tab === 'categories' ? (
            <div className="max-w-3xl">
              <CategoryTable
                budgets={sortedBudgets}
                income={income}
                hasIncome={hasIncome}
                pace={pace}
                onDelete={requestDelete}
                onAdd={() => setIsModalOpen(true)}
              />
            </div>
          ) : (
            <section className="flex flex-col lg:flex-row gap-10 lg:gap-12">
              {/* ── Left: progress, categories, alerts ── */}
              <div className="lg:flex-1 min-w-0 flex flex-col gap-10">
                <SpendingProgress
                  totalSpent={totalSpent}
                  totalAllocated={totalAllocated}
                  spendPct={spendPct}
                  pace={pace}
                />

                <CategoryTable
                  budgets={sortedBudgets}
                  income={income}
                  hasIncome={hasIncome}
                  pace={pace}
                  onDelete={requestDelete}
                  onAdd={() => setIsModalOpen(true)}
                />

                <BudgetAlerts
                  budgets={sortedBudgets}
                  categoryStats={categoryStats}
                  pace={pace}
                />
              </div>

              {/* ── Right: monthly budget, breakdown, insights ── */}
              <div className="lg:w-[340px] lg:flex-shrink-0 flex flex-col gap-9 lg:border-l lg:border-[color-mix(in_oklab,var(--color-fg),transparent_92%)] lg:pl-12">
                <MonthlyBudgetCard
                  totalAllocated={totalAllocated}
                  overAllocated={overAllocated}
                  income={income}
                  savedIncome={savedIncome}
                  fallbackIncome={Number(fallbackIncome || 0)}
                  onEdit={() => setIsModalOpen(true)}
                  onIncomeChanged={async () => {
                    await refreshProfile?.();
                  }}
                />

                <BreakdownDonut budgets={sortedBudgets} totalAllocated={totalAllocated} />

                <Insights
                  projectedSpent={projectedSpent}
                  projectedRemaining={projectedRemaining}
                  totalAllocated={totalAllocated}
                />
              </div>
            </section>
          )}
        </>
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
  return { iconName: src?.icon_name || null, iconLib: src?.icon_lib || null };
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
      style={{ width: size, height: size, backgroundColor: color || 'var(--color-muted)' }}
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

const HAIRLINE = 'border-[color-mix(in_oklab,var(--color-fg),transparent_92%)]';

// ─── Spending progress (hero) ─────────────────────────────────────────

interface SpendingProgressProps {
  totalSpent: number;
  totalAllocated: number;
  spendPct: number;
  pace: PaceInfo;
}

function SpendingProgress({ totalSpent, totalAllocated, spendPct, pace }: SpendingProgressProps) {
  const over = isBudgetOver(totalSpent, totalAllocated);
  const aheadOfPace = !over && spendPct > pace.fraction * 100 + 2;
  const fillColor = over
    ? 'var(--color-danger)'
    : aheadOfPace
      ? '#f59e0b'
      : 'var(--color-success)';

  const daysLeft = Math.max(0, pace.daysInMonth - pace.day);
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const rangeStart = new Date(now.getFullYear(), now.getMonth(), pace.day + 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth(), pace.daysInMonth);

  return (
    <div>
      <div className="overline mb-2">Spending progress</div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-medium tracking-tight text-[var(--color-fg)] tabular-nums">
            {formatCurrency(totalSpent)}
          </span>
          <span className="text-sm text-[var(--color-muted)] tabular-nums">
            of {formatCurrency(totalAllocated)}
          </span>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
            {daysLeft > 0 ? `${daysLeft} days left` : 'Last day'}
          </div>
          {daysLeft > 0 && (
            <div className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
              {fmt(rangeStart)} – {fmt(rangeEnd)}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 h-2.5 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, spendPct))}%`, backgroundColor: fillColor }}
        />
      </div>
      <div
        className="mt-2 text-xs font-medium tabular-nums"
        style={{ color: fillColor }}
      >
        {over
          ? `${formatCurrency(totalSpent - totalAllocated)} over budget`
          : `${spendPct.toFixed(0)}% of budget used`}
      </div>
    </div>
  );
}

// ─── Category table ───────────────────────────────────────────────────

interface CategoryTableProps {
  budgets: BudgetRecord[];
  income: number;
  hasIncome: boolean;
  pace: PaceInfo;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

function CategoryTable({ budgets, income, hasIncome, pace, onDelete, onAdd }: CategoryTableProps) {
  return (
    <div>
      <h2 className="text-lg font-medium text-[var(--color-fg)] mb-4">Budget categories</h2>

      {/* Column header */}
      <div className={`grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1fr_1.4fr] gap-4 px-3 pb-2 border-b ${HAIRLINE} text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]`}>
        <span>Category</span>
        <span className="hidden sm:block text-right">Budget</span>
        <span className="hidden sm:block text-right">Spent</span>
        <span className="text-right">Remaining</span>
      </div>

      <div className="flex flex-col">
        {budgets.map((b, i) => (
          <CategoryTableRow
            key={b.id}
            budget={b}
            income={income}
            hasIncome={hasIncome}
            pace={pace}
            onDelete={() => onDelete(b.id)}
            isLast={i === budgets.length - 1}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onAdd}
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--color-success)] hover:opacity-80 transition-opacity"
      >
        <LuPlus className="w-4 h-4" />
        Add category
      </button>
    </div>
  );
}

interface CategoryTableRowProps {
  budget: BudgetRecord;
  income: number;
  hasIncome: boolean;
  pace: PaceInfo;
  onDelete: () => void;
  isLast: boolean;
}

function CategoryTableRow({ budget, income, hasIncome, pace, onDelete, isLast }: CategoryTableRowProps) {
  const { iconName, iconLib } = getIconMeta(budget);
  const color = getColor(budget);
  const label = getLabel(budget);
  const amount = Number(budget.amount || 0);
  const spent = Number(budget.spent || 0);
  const remaining = amount - spent;
  const spendPct = amount > 0 ? Math.min(100, (spent / amount) * 100) : 0;
  const rawPct = Number(budget.percentage || 0) || (amount > 0 ? (spent / amount) * 100 : 0);
  const allocPct = hasIncome && amount > 0 ? (amount / income) * 100 : 0;

  const overBudget = isBudgetOver(spent, amount);
  const aheadOfPace = !overBudget && rawPct > pace.fraction * 100 + 2 && rawPct < 100;
  const barColor = overBudget
    ? 'var(--color-danger)'
    : aheadOfPace
      ? '#f59e0b'
      : color;

  return (
    <div
      className={`group grid grid-cols-[1fr_auto] sm:grid-cols-[2fr_1fr_1fr_1.4fr] items-center gap-4 py-3.5 px-3 -mx-3 rounded-lg hover:bg-[var(--color-card-highlight)] ${!isLast ? `border-b ${HAIRLINE}` : ''}`}
    >
      {/* Category */}
      <div className="flex items-center gap-3 min-w-0">
        <CategoryIcon iconName={iconName} iconLib={iconLib} color={color} size={36} />
        <div className="min-w-0">
          <p className="font-medium text-sm text-[var(--color-fg)] truncate">{label}</p>
          {hasIncome && allocPct > 0 && (
            <p className="text-[11px] text-[var(--color-muted)] tabular-nums mt-0.5">
              {allocPct.toFixed(0)}% of income
            </p>
          )}
        </div>
      </div>

      {/* Budget */}
      <div className="hidden sm:block text-right text-sm tabular-nums text-[var(--color-muted)]">
        {formatCurrency(amount)}
      </div>

      {/* Spent */}
      <div className="hidden sm:block text-right text-sm tabular-nums text-[var(--color-fg)]">
        {formatCurrency(spent)}
      </div>

      {/* Remaining + bar + pct + controls */}
      <div className="flex items-center justify-end gap-3">
        <div className="text-right">
          <div
            className="text-sm font-semibold tabular-nums"
            style={{ color: overBudget ? 'var(--color-danger)' : 'var(--color-fg)' }}
          >
            {formatCurrency(remaining)}
          </div>
        </div>
        <div className="hidden md:block w-16">
          <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${spendPct}%`, backgroundColor: barColor }}
            />
          </div>
        </div>
        <span className="hidden md:block w-9 text-right text-xs tabular-nums text-[var(--color-muted)]">
          {rawPct.toFixed(0)}%
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-[var(--color-muted)] hover:text-[var(--color-danger)] rounded transition-opacity"
          title="Delete budget"
          aria-label={`Delete ${label} budget`}
        >
          <LuTrash2 size={14} />
        </button>
        <LuChevronRight className="w-4 h-4 text-[var(--color-muted)] opacity-40 group-hover:opacity-0 transition-opacity hidden sm:block" />
      </div>
    </div>
  );
}

// ─── Budget alerts ────────────────────────────────────────────────────

interface AlertItem {
  id: string;
  kind: 'over' | 'near' | 'pace' | 'trend';
  title: string;
  description: string;
}

interface BudgetAlertsProps {
  budgets: BudgetRecord[];
  categoryStats: CategoryStat[];
  pace: PaceInfo;
}

function BudgetAlerts({ budgets, categoryStats, pace }: BudgetAlertsProps) {
  const alerts = useMemo<AlertItem[]>(() => {
    const out: AlertItem[] = [];
    const avgByGroup = new Map<string, number>();
    categoryStats.forEach((c) => avgByGroup.set(c.id, Number(c.monthly_avg || 0)));

    for (const b of budgets) {
      const label = getLabel(b);
      const amount = Number(b.amount || 0);
      const spent = Number(b.spent || 0);
      if (amount <= 0) continue;
      const pct = (spent / amount) * 100;

      if (isBudgetOver(spent, amount)) {
        out.push({
          id: `over-${b.id}`,
          kind: 'over',
          title: `You've exceeded your ${label} budget`,
          description: `${formatCurrency(spent - amount)} over your ${formatCurrency(amount)} limit`,
        });
      } else if (pct >= 85) {
        out.push({
          id: `near-${b.id}`,
          kind: 'near',
          title: `You've spent ${pct.toFixed(0)}% of your ${label} budget`,
          description: `You have ${formatCurrency(amount - spent)} remaining`,
        });
      } else if (pct > pace.fraction * 100 + 15) {
        out.push({
          id: `pace-${b.id}`,
          kind: 'pace',
          title: `${label} is trending high`,
          description: `${pct.toFixed(0)}% spent with ${(pace.fraction * 100).toFixed(0)}% of the month elapsed`,
        });
      } else {
        const avg = avgByGroup.get(b.category_group_id || '') || 0;
        if (avg > 0 && spent > avg * 1.2) {
          out.push({
            id: `trend-${b.id}`,
            kind: 'trend',
            title: `${label} is trending high`,
            description: `${formatCurrency(spent)} this month vs ${formatCurrency(avg)} typical`,
          });
        }
      }
    }
    return out.slice(0, 4);
  }, [budgets, categoryStats, pace]);

  if (alerts.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-medium text-[var(--color-fg)] mb-4">Recent budget alerts</h2>
        <div className="flex items-center gap-3 py-4 text-sm text-[var(--color-muted)]">
          <LuCircleCheck className="w-5 h-5 text-[var(--color-success)] flex-shrink-0" />
          Every category is comfortably within budget. Nice work.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium text-[var(--color-fg)] mb-4">Recent budget alerts</h2>
      <div className="flex flex-col">
        {alerts.map((a, i) => (
          <AlertRow key={a.id} alert={a} isLast={i === alerts.length - 1} />
        ))}
      </div>
    </div>
  );
}

function AlertRow({ alert, isLast }: { alert: AlertItem; isLast: boolean }) {
  const config = {
    over: { Icon: LuTriangleAlert, color: 'var(--color-danger)' },
    near: { Icon: LuTrendingUp, color: '#f59e0b' },
    pace: { Icon: LuTrendingUp, color: '#f59e0b' },
    trend: { Icon: LuTrendingUp, color: '#f59e0b' },
  }[alert.kind];
  const { Icon, color } = config;

  return (
    <div className={`flex items-start gap-3 py-3.5 ${!isLast ? `border-b ${HAIRLINE}` : ''}`}>
      <div
        className="mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `color-mix(in oklab, ${color}, transparent 85%)` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-fg)]">{alert.title}</p>
        <p className="text-[12px] text-[var(--color-muted)] mt-0.5">{alert.description}</p>
      </div>
    </div>
  );
}

// ─── Monthly budget (right) ───────────────────────────────────────────

interface MonthlyBudgetCardProps {
  totalAllocated: number;
  overAllocated: number;
  income: number;
  savedIncome: number;
  fallbackIncome: number;
  onEdit: () => void;
  onIncomeChanged: () => Promise<void> | void;
}

function MonthlyBudgetCard({
  totalAllocated,
  overAllocated,
  income,
  savedIncome,
  fallbackIncome,
  onEdit,
  onIncomeChanged,
}: MonthlyBudgetCardProps) {
  return (
    <div>
      <div className="overline mb-2">Monthly budget</div>
      <div className="text-3xl font-medium tracking-tight text-[var(--color-fg)] tabular-nums">
        {formatCurrency(totalAllocated)}
      </div>
      {income > 0 && (
        <div className="mt-1 text-xs text-[var(--color-muted)] tabular-nums">
          {((totalAllocated / income) * 100).toFixed(0)}% of {formatCurrency(income)} income
          {overAllocated > 0 && (
            <span className="text-[var(--color-danger)]"> · {formatCurrency(overAllocated)} over</span>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-success)] hover:opacity-80 transition-opacity"
      >
        <LuPlus className="w-3.5 h-3.5" />
        Add or edit budgets
      </button>

      <div className={`mt-4 pt-4 border-t ${HAIRLINE}`}>
        <IncomeEditor
          savedIncome={savedIncome}
          fallbackIncome={fallbackIncome}
          onChanged={onIncomeChanged}
        />
      </div>
    </div>
  );
}

// ─── Breakdown donut (right) ──────────────────────────────────────────

function BreakdownDonut({
  budgets,
  totalAllocated,
}: {
  budgets: BudgetRecord[];
  totalAllocated: number;
}) {
  const data = useMemo(
    () =>
      budgets
        .map((b) => ({ label: getLabel(b), value: Number(b.amount || 0), color: getColor(b) }))
        .filter((d) => d.value > 0),
    [budgets],
  );

  if (data.length === 0) return null;

  return (
    <div>
      <div className="overline mb-4">Budget breakdown</div>

      <div className="flex justify-center mb-6">
        <div className="relative" style={{ width: 180, height: 180 }}>
          <CustomDonut data={data} size={180} strokeWidth={22} showTotal={false} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xl font-semibold text-[var(--color-fg)] tabular-nums">
              {formatCurrency(totalAllocated)}
            </div>
            <div className="text-xs text-[var(--color-muted)]">Total</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {data.map((d) => {
          const pct = totalAllocated > 0 ? (d.value / totalAllocated) * 100 : 0;
          return (
            <div key={d.label} className="flex items-center gap-2.5 text-sm">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: d.color }}
              />
              <span className="flex-1 min-w-0 truncate text-[var(--color-fg)]">{d.label}</span>
              <span className="tabular-nums text-[var(--color-fg)]">{formatCurrency(d.value)}</span>
              <span className="w-12 text-right tabular-nums text-[var(--color-muted)]">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>

      <div className={`mt-3 pt-3 border-t ${HAIRLINE} flex items-center gap-2.5 text-sm font-medium`}>
        <span className="w-2.5 flex-shrink-0" />
        <span className="flex-1 text-[var(--color-fg)]">Total</span>
        <span className="tabular-nums text-[var(--color-fg)]">{formatCurrency(totalAllocated)}</span>
        <span className="w-12 text-right tabular-nums text-[var(--color-muted)]">100%</span>
      </div>
    </div>
  );
}

// ─── Insights (right) ─────────────────────────────────────────────────

interface InsightsProps {
  projectedSpent: number;
  projectedRemaining: number;
  totalAllocated: number;
}

function Insights({ projectedSpent, projectedRemaining, totalAllocated }: InsightsProps) {
  const onTrack = projectedRemaining >= 0;
  const projFillPct =
    totalAllocated > 0 ? Math.min(100, (projectedSpent / totalAllocated) * 100) : 0;
  const fillColor = onTrack ? 'var(--color-success)' : 'var(--color-danger)';

  return (
    <div>
      <div className="overline mb-4">Insights</div>

      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `color-mix(in oklab, ${fillColor}, transparent 85%)` }}
        >
          <LuSparkles className="w-4 h-4" style={{ color: fillColor }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-fg)]">
            {onTrack ? "You're on track to stay under budget" : "You're projected to go over budget"}
          </p>
          <p className="text-[12px] text-[var(--color-muted)] mt-0.5 leading-relaxed">
            {onTrack ? (
              <>
                Keep it up! You&apos;re projected to have{' '}
                <span className="font-medium" style={{ color: fillColor }}>
                  {formatCurrency(projectedRemaining)}
                </span>{' '}
                remaining by month end.
              </>
            ) : (
              <>
                At your current pace you&apos;ll be{' '}
                <span className="font-medium" style={{ color: fillColor }}>
                  {formatCurrency(Math.abs(projectedRemaining))}
                </span>{' '}
                over by month end.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[11px] text-[var(--color-muted)] mb-2">Projected at month end</div>
        <div className="flex items-center justify-between text-xs tabular-nums mb-1.5">
          <span className="text-[var(--color-fg)]">{formatCurrency(projectedSpent)} spent</span>
          <span style={{ color: fillColor }}>
            {projectedRemaining >= 0
              ? `${formatCurrency(projectedRemaining)} left`
              : `${formatCurrency(Math.abs(projectedRemaining))} over`}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${projFillPct}%`, backgroundColor: fillColor }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function BudgetsSkeleton() {
  const bar = "bg-[var(--color-border)] rounded";
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div className={`h-6 w-32 ${bar}`} />
        <div className={`h-8 w-44 ${bar} rounded-full`} />
      </div>
      <section className="flex flex-col lg:flex-row gap-10 lg:gap-12">
        <div className="lg:flex-1 flex flex-col gap-10">
          <div>
            <div className={`h-3 w-32 ${bar} mb-3`} />
            <div className={`h-10 w-56 ${bar} mb-4`} />
            <div className={`h-2.5 w-full ${bar}`} />
          </div>
          <div>
            <div className={`h-5 w-40 ${bar} mb-4`} />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex items-center gap-4 py-3.5 px-3 border-b ${HAIRLINE}`}>
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
        <div className="lg:w-[340px] lg:flex-shrink-0 flex flex-col gap-9">
          <div>
            <div className={`h-3 w-24 ${bar} mb-3`} />
            <div className={`h-9 w-40 ${bar}`} />
          </div>
          <div className="flex flex-col items-center gap-5">
            <div className={`h-44 w-44 rounded-full ${bar}`} />
            <div className="w-full space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-4 w-full ${bar}`} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
