"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '../../../components/UserProvider';
import PageContainer from '../../../components/PageContainer';
import BudgetCard from '../../../components/budgets/BudgetCard';
import CreateBudgetModal from '../../../components/budgets/CreateBudgetModal';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import { LuPlus, LuPiggyBank } from 'react-icons/lu';

export default function BudgetsPage() {
  const { user } = useUser();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchBudgets = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/budgets?userId=${user.id}`);
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
      await fetch(`/api/budgets?id=${id}&userId=${user.id}`, { method: 'DELETE' });
      fetchBudgets();
    } catch (e) {
      console.error(e);
      alert('Failed to delete budget');
    }
  };

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
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center gap-12 lg:gap-16 py-12 lg:py-20">
            {/* Subtle background effects */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Soft radial glow behind the content */}
              <div
                className="absolute top-1/2 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] opacity-[0.03] dark:opacity-[0.05]"
                style={{
                  background: `radial-gradient(ellipse at center, var(--color-accent) 0%, transparent 70%)`
                }}
              />
            </div>

            {/* Decorative accent line */}
            <div className="absolute top-0 left-0 w-16 h-1 bg-gradient-to-r from-[var(--color-accent)] to-transparent rounded-full" />

            {/* Left side - Copy */}
            <div className="relative flex-1 max-w-xs">
              <h1 className="text-3xl sm:text-4xl font-semibold text-[var(--color-fg)] mb-4 tracking-tight leading-tight">
                Start Tracking Your Spending
              </h1>
              <p className="text-base text-[var(--color-muted)] mb-8 leading-relaxed">
                Create your first budget to gain insights and see your financial progress flow.
              </p>
              <Button size="lg" onClick={() => setIsModalOpen(true)} className="gap-2">
                <LuPlus className="w-4 h-4" />
                Create a Budget
              </Button>
            </div>

            {/* Right side - Faded UI Preview */}
            <div className="relative flex-1 w-full lg:w-auto">
              <div className="relative">
                {/* Fade overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[var(--color-bg)] pointer-events-none z-10" />

                {/* Mock budget cards */}
                <div className="space-y-4 opacity-60">
                  {/* Mock Card 1 */}
                  <div className="bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
                          <div className="w-4 h-4 rounded bg-[var(--color-accent)]/40" />
                        </div>
                        <div>
                          <div className="h-4 w-24 bg-[var(--color-muted)]/20 rounded" />
                        </div>
                      </div>
                      <div className="h-4 w-16 bg-[var(--color-muted)]/20 rounded" />
                    </div>
                    <div className="h-2 w-full bg-[var(--color-muted)]/10 rounded-full overflow-hidden">
                      <div className="h-full w-3/5 bg-[var(--color-accent)]/40 rounded-full" />
                    </div>
                    <div className="flex justify-between mt-2">
                      <div className="h-3 w-12 bg-[var(--color-muted)]/15 rounded" />
                      <div className="h-3 w-12 bg-[var(--color-muted)]/15 rounded" />
                    </div>
                  </div>

                  {/* Mock Card 2 */}
                  <div className="bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                          <div className="w-4 h-4 rounded bg-emerald-500/40" />
                        </div>
                        <div>
                          <div className="h-4 w-20 bg-[var(--color-muted)]/20 rounded" />
                        </div>
                      </div>
                      <div className="h-4 w-14 bg-[var(--color-muted)]/20 rounded" />
                    </div>
                    <div className="h-2 w-full bg-[var(--color-muted)]/10 rounded-full overflow-hidden">
                      <div className="h-full w-2/5 bg-emerald-500/40 rounded-full" />
                    </div>
                    <div className="flex justify-between mt-2">
                      <div className="h-3 w-10 bg-[var(--color-muted)]/15 rounded" />
                      <div className="h-3 w-14 bg-[var(--color-muted)]/15 rounded" />
                    </div>
                  </div>

                  {/* Mock Card 3 - partially visible */}
                  <div className="bg-[var(--color-surface)] rounded-xl p-5 border border-[var(--color-border)]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <div className="w-4 h-4 rounded bg-amber-500/40" />
                        </div>
                        <div>
                          <div className="h-4 w-28 bg-[var(--color-muted)]/20 rounded" />
                        </div>
                      </div>
                      <div className="h-4 w-12 bg-[var(--color-muted)]/20 rounded" />
                    </div>
                    <div className="h-2 w-full bg-[var(--color-muted)]/10 rounded-full overflow-hidden">
                      <div className="h-full w-4/5 bg-amber-500/40 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
    </PageContainer>
  );
}
