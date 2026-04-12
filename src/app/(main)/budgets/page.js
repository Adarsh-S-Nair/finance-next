"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '../../../components/providers/UserProvider';
import PageContainer from '../../../components/layout/PageContainer';
import BudgetCard from '../../../components/budgets/BudgetCard';
import CreateBudgetModal from '../../../components/budgets/CreateBudgetModal';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import UpgradeOverlay from '../../../components/UpgradeOverlay';
import { EmptyState } from "@slate-ui/react";
import { LuPlus } from 'react-icons/lu';

export default function BudgetsPage() {
  const { user, isPro } = useUser();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchBudgets();
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="h-40 animate-pulse bg-[var(--color-surface)] opacity-50" />
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <EmptyState>
            <EmptyState.Hero
              layout="centered"
              title="No budgets yet"
              description="Set a monthly limit for a category or category group and track your spending against it."
              action={
                <Button size="lg" onClick={() => setIsModalOpen(true)} className="gap-2">
                  <LuPlus className="w-4 h-4" />
                  Create a Budget
                </Button>
              }
            />
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {budgets.map(b => (
              <BudgetCard key={b.id} budget={b} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      <CreateBudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchBudgets}
      />
      <UpgradeOverlay isOpen={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </PageContainer>
  );
}
