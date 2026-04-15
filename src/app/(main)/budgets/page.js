"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import * as Icons from 'lucide-react';
import { useUser } from '../../../components/providers/UserProvider';
import PageContainer from '../../../components/layout/PageContainer';
import IncomeBreakdownChart from '../../../components/budgets/IncomeBreakdownChart';
import CreateBudgetOverlay from '../../../components/budgets/CreateBudgetOverlay';
import Button from '../../../components/ui/Button';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import UpgradeOverlay from '../../../components/UpgradeOverlay';
import { EmptyState } from '@slate-ui/react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import { formatCurrency } from '../../../lib/formatCurrency';

export default function BudgetsPage() {
  const { user, isPro } = useUser();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [incomeMonths, setIncomeMonths] = useState([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchIncome = async () => {
    if (!user?.id) return;
    setIncomeLoading(true);
    try {
      const res = await fetch(`/api/transactions/spending-earning?months=6`);
      const json = await res.json();
      const months = Array.isArray(json?.data) ? json.data : [];
      const completed = months.filter((m) => m.isComplete);
      const sample = completed.length > 0 ? completed : months;
      const totalEarning = sample.reduce(
        (sum, m) => sum + Number(m.earning || 0),
        0
      );
      const avg = sample.length > 0 ? totalEarning / sample.length : 0;
      setMonthlyIncome(avg);
      setIncomeMonths(sample);
    } catch (e) {
      console.error(e);
      setMonthlyIncome(0);
      setIncomeMonths([]);
    } finally {
      setIncomeLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
    fetchIncome();
  }, [user?.id]);

  // Exit select mode automatically when no budgets remain.
  useEffect(() => {
    if (budgets.length === 0 && selectMode) {
      setSelectMode(false);
      setSelectedIds(new Set());
    }
  }, [budgets.length, selectMode]);

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

  const income = Number(monthlyIncome || 0);
  const hasIncome = income > 0;
  const unallocated = Math.max(0, income - totalAllocated);
  const overAllocated = Math.max(0, totalAllocated - income);
  const barTotal = Math.max(income, totalAllocated);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(sortedBudgets.map((b) => b.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

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

  return (
    <PageContainer title="Budgets" action={headerAction}>
      <div className="space-y-12">
        {loading ? (
          <BudgetsSkeleton />
        ) : !hasBudgets ? (
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

              <div className="mt-14 pt-8 border-t border-[var(--color-border)] max-w-sm">
                <div className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-4">
                  What to expect
                </div>
                <div className="space-y-4">
                  {[
                    'Confirm your average monthly income',
                    'Pick categories from your actual spending',
                    'Review suggested amounts and tune as needed',
                  ].map((label, i) => (
                    <div key={i} className="flex items-baseline gap-4 text-sm">
                      <span className="text-[var(--color-muted)] tabular-nums font-medium">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className="text-[var(--color-fg)]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </EmptyState>
        ) : (
          <>
            {/* Summary stats row */}
            <div className="grid grid-cols-3 gap-6 sm:gap-10">
              <Stat
                label="Income"
                value={hasIncome ? formatCurrency(income) : '—'}
                loading={incomeLoading}
              />
              <Stat
                label="Allocated"
                value={formatCurrency(totalAllocated)}
              />
              <Stat
                label={overAllocated > 0 ? 'Over budget' : 'Unallocated'}
                value={formatCurrency(overAllocated > 0 ? overAllocated : unallocated)}
                tone={overAllocated > 0 ? 'danger' : 'default'}
                loading={incomeLoading && !overAllocated}
              />
            </div>

            {/* Segmented allocation bar */}
            <div className="space-y-2">
              <div className="relative h-2 w-full rounded-full overflow-hidden bg-[var(--color-border)] flex">
                {sortedBudgets.map((b) => {
                  const pct = barTotal > 0 ? (Number(b.amount) / barTotal) * 100 : 0;
                  if (pct <= 0) return null;
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      className="h-full"
                      style={{ backgroundColor: getColor(b) }}
                      title={`${getLabel(b)} · ${formatCurrency(Number(b.amount))}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-[var(--color-muted)] tabular-nums font-medium">
                <span>$0</span>
                <span>{formatCurrency(barTotal)}</span>
              </div>
            </div>

            {/* Income breakdown chart */}
            {!incomeLoading && incomeMonths.length > 0 && (
              <div>
                <IncomeBreakdownChart months={incomeMonths} avg={income} />
              </div>
            )}

            {/* Budgets list */}
            <div>
              <div className="mb-4 px-1 flex items-end justify-between">
                <h2 className="text-lg font-medium text-[var(--color-fg)]">Your budgets</h2>
                <span className="text-xs text-[var(--color-muted)] tabular-nums">
                  {sortedBudgets.length} {sortedBudgets.length === 1 ? 'budget' : 'budgets'}
                </span>
              </div>

              <div className="flex flex-col">
                {sortedBudgets.map((b) => (
                  <BudgetRow
                    key={b.id}
                    budget={b}
                    income={income}
                    hasIncome={hasIncome}
                    selectMode={selectMode}
                    selected={selectedIds.has(b.id)}
                    onToggleSelect={() => toggleSelect(b.id)}
                    onDelete={() => requestDelete([b.id])}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <CreateBudgetOverlay
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchBudgets}
        monthlyIncome={monthlyIncome}
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
  const iconName = isGroup ? b.category_groups?.icon_name : null;
  return iconName && Icons[iconName] ? Icons[iconName] : Icons.Wallet;
}

// ─── Stat ─────────────────────────────────────────────────────────────

function Stat({ label, value, tone = 'default', loading = false }) {
  const valueColor = tone === 'danger' ? 'var(--color-danger)' : 'var(--color-fg)';
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-muted)] font-medium mb-1.5">
        {label}
      </p>
      {loading ? (
        <div className="h-7 w-24 rounded bg-[var(--color-border)] animate-pulse" />
      ) : (
        <p
          className="text-xl sm:text-2xl font-semibold tabular-nums"
          style={{ color: valueColor }}
        >
          {value}
        </p>
      )}
    </div>
  );
}

// ─── Budget row ───────────────────────────────────────────────────────

function BudgetRow({ budget, income, hasIncome, selectMode, selected, onToggleSelect, onDelete }) {
  const Icon = getIcon(budget);
  const color = getColor(budget);
  const label = getLabel(budget);
  const amount = Number(budget.amount || 0);
  const spent = Number(budget.spent || 0);
  const spendPct = Number(budget.percentage || 0);
  const allocPct = hasIncome && amount > 0 ? (amount / income) * 100 : 0;

  let progressColor = color;
  if (spendPct >= 100) progressColor = 'var(--color-danger)';
  else if (spendPct >= 85) progressColor = '#f59e0b';

  const handleRowClick = () => {
    if (selectMode) onToggleSelect();
  };

  return (
    <div
      onClick={handleRowClick}
      className={`
        group flex items-center gap-4 px-3 sm:px-5 py-4 rounded-lg
        transition-colors
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

      {/* Icon */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          backgroundColor: `color-mix(in oklab, ${color}, transparent 85%)`,
          color,
        }}
      >
        <Icon size={16} />
      </div>

      {/* Label + spending progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm text-[var(--color-fg)] truncate">{label}</p>
          {hasIncome && (
            <span className="text-[10px] text-[var(--color-muted)] tabular-nums whitespace-nowrap">
              {allocPct.toFixed(0)}% of income
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1 bg-[var(--color-border)] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(spendPct, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ backgroundColor: progressColor }}
            />
          </div>
          <span className="text-[10px] text-[var(--color-muted)] tabular-nums whitespace-nowrap">
            {spendPct.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-[var(--color-fg)] tabular-nums">
          {formatCurrency(amount)}
        </p>
        <p className="text-[11px] text-[var(--color-muted)] tabular-nums">
          {formatCurrency(spent)} spent
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

// ─── Skeleton ─────────────────────────────────────────────────────────

function BudgetsSkeleton() {
  return (
    <div className="space-y-12 animate-pulse">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 sm:gap-10">
        {[...Array(3)].map((_, i) => (
          <div key={i}>
            <div className="h-3 w-16 bg-[var(--color-border)] rounded mb-2" />
            <div className="h-7 w-24 bg-[var(--color-border)] rounded" />
          </div>
        ))}
      </div>
      {/* Bar */}
      <div className="h-2 w-full bg-[var(--color-border)] rounded-full" />
      {/* Rows */}
      <div className="space-y-1">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-[var(--color-border)]" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-[var(--color-border)] rounded mb-2" />
              <div className="h-1 w-full bg-[var(--color-border)] rounded-full" />
            </div>
            <div>
              <div className="h-4 w-16 bg-[var(--color-border)] rounded mb-1.5" />
              <div className="h-3 w-12 bg-[var(--color-border)] rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
