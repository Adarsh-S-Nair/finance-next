"use client";

import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";
import Input from "../ui/Input";
import Button from "../ui/Button";
import { useUser } from "../UserProvider";
import * as Icons from "lucide-react";

export default function CreateBudgetModal({ isOpen, onClose, onCreated }) {
  const { user } = useUser();
  const [step, setStep] = useState(1); // 1: Select Scope (Group/Category), 2: Set Amount
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Selection state
  const [selectedScope, setSelectedScope] = useState(null); // { id, label, type: 'group'|'category' }
  const [amount, setAmount] = useState("");

  // Fetch options on open
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSelectedScope(null);
      setAmount("");
      setSearchTerm("");
      fetchOptions();
    }
  }, [isOpen]);

  async function fetchOptions() {
    setLoading(true);
    try {
      // We need existing category groups and categories
      // Ideally we should have an API for this, or reuse existing endpoint
      // For now, let's fetch spending categories to get "smart suggestions" or just all groups

      // Fetch groups
      // TODO: Replace with proper API endpoint if available. 
      // Using a direct fetch logic here might be messy.
      // Let's assume we can hit the spending endpoint to get active categories.
      const res = await fetch(`/api/transactions/spending-by-category?userId=${user.id}&days=90&groupBy=group`);
      const data = await res.json();

      const groupOptions = data.categories.map(c => ({
        id: c.id,
        label: c.label,
        type: 'group',
        spent: c.total_spent
      }));

      // We could also fetch system_categories but let's start with Groups for simplicity as proposed
      setOptions(groupOptions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNext = () => {
    if (selectedScope) setStep(2);
  };

  const handleSubmit = async () => {
    if (!amount || !selectedScope) return;

    setLoading(true);
    try {
      const payload = {
        userId: user.id,
        amount: parseFloat(amount),
        period: 'monthly',
        [selectedScope.type === 'group' ? 'category_group_id' : 'category_id']: selectedScope.id
      };

      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to create budget');

      onCreated();
      onClose();
    } catch (e) {
      console.error(e);
      alert('Error creating budget');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? "Choose a Category Group" : "Set Monthly Budget"}
      description={step === 1 ? "Select what you want to track." : `How much do you want to spend on ${selectedScope?.label}?`}
      size="sm"
    >
      <div className="h-[300px] flex flex-col">
        {step === 1 ? (
          <>
            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
              autoFocus
            />

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                <div className="text-center py-4 text-[var(--color-muted)]">Loading...</div>
              ) : (
                filteredOptions.map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setSelectedScope(opt); setStep(2); }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors text-left"
                  >
                    <span className="font-medium text-[var(--color-fg)]">{opt.label}</span>
                    {opt.spent > 0 && (
                      <span className="text-xs text-[var(--color-muted)]">
                        ~${Math.round(opt.spent / 3)} / mo
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col justify-center h-full gap-6">
            <div className="text-center">
              <span className="text-3xl font-bold text-[var(--color-fg)]">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-40 text-4xl font-bold bg-transparent border-b-2 border-[var(--color-border)] text-[var(--color-fg)] focus:border-zinc-900 focus:outline-none text-center pb-2 mx-2"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              />
            </div>

            {selectedScope?.spent > 0 && (
              <p className="text-sm text-center text-[var(--color-muted)]">
                Average spend: ${Math.round(selectedScope.spent / 3)}
              </p>
            )}

            <div className="flex gap-3 justify-center mt-4">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleSubmit} disabled={loading || !amount}>
                {loading ? "Saving..." : "Save Budget"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
