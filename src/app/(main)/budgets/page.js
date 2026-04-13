"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '../../../components/providers/UserProvider';
import PageContainer from '../../../components/layout/PageContainer';
import BudgetAllocationBar from '../../../components/budgets/BudgetAllocationBar';
import CreateBudgetOverlay from '../../../components/budgets/CreateBudgetOverlay';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import UpgradeOverlay from '../../../components/UpgradeOverlay';
import { EmptyState } from "@slate-ui/react";
import { LuPlus } from 'react-icons/lu';

export default function BudgetsPage() {
  const { user, isPro } = useUser();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [incomeMonths, setIncomeMonths] = useState([]);
  const [incomeLoading, setIncomeLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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
      // Average monthly income over the completed months the API returns.
      // Note: if the user switched direct deposit mid-window or hasn't
      // connected all their accounts, a recent month may legitimately look
      // like $0 and drag this average down. We surface a hint in the UI
      // advising users to connect more institutions for a better picture.
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

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;
    try {
      await fetch(`/api/budgets?id=${id}`, { method: 'DELETE' });
      fetchBudgets();
    } catch (e) {
      console.error(e);
      alert('Failed to delete budget');
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

  return (
    <PageContainer
      title="Budgets"
      action={
        budgets.length > 0 && (
          <Button
            size="sm"
            variant="matte"
            onClick={() => setIsModalOpen(true)}
            className="gap-1.5 !rounded-full pl-3 pr-4"
          >
            <LuPlus className="w-3.5 h-3.5" />
            New Budget
          </Button>
        )
      }
    >
      <div className="space-y-8">
        {loading ? (
          <Card className="h-80 animate-pulse bg-[var(--color-surface)] opacity-50" />
        ) : budgets.length === 0 ? (
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
                <div className="card-header mb-4">What to expect</div>
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
          <BudgetAllocationBar
            budgets={budgets}
            monthlyIncome={monthlyIncome}
            incomeMonths={incomeMonths}
            incomeLoading={incomeLoading}
            onDelete={handleDelete}
          />
        )}
      </div>

      <CreateBudgetOverlay
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchBudgets}
        monthlyIncome={monthlyIncome}
        existingBudgets={budgets}
      />
      <UpgradeOverlay isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </PageContainer>
  );
}
