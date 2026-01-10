"use client";

import React, { useState, useEffect } from 'react';
import { useUser } from '../../../components/UserProvider';
import BudgetCard from '../../../components/budgets/BudgetCard';
import CreateBudgetModal from '../../../components/budgets/CreateBudgetModal';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import * as Icons from 'lucide-react';

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
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-fg)]">Budgets</h1>
          <p className="text-[var(--color-muted)] mt-1">Track your spending and save for what matters</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Icons.Plus size={18} /> New Budget
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="h-40 animate-pulse bg-[var(--color-bg-secondary)] opacity-50" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <Card className="p-16 text-center flex flex-col items-center gap-4 border-dashed">
          <div className="p-4 bg-[var(--color-bg-secondary)] rounded-full text-[var(--color-muted)]">
            <Icons.PieChart size={32} />
          </div>
          <div className="max-w-sm">
            <h3 className="text-lg font-medium text-[var(--color-fg)]">No budgets yet</h3>
            <p className="text-[var(--color-muted)] mt-1">Create your first budget to start tracking your spending habits.</p>
          </div>
          <Button variant="outline" onClick={() => setIsModalOpen(true)}>
            Create Budget
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {budgets.map(b => (
            <BudgetCard key={b.id} budget={b} onDelete={handleDelete} />
          ))}
        </div>
      )}

      <CreateBudgetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchBudgets}
      />
    </div>
  );
}
