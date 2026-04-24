import React, { useState, useEffect } from 'react';
import TransactionRow from './TransactionRow';
import RuleBuilder from './RuleBuilder';
import { OverlayButton } from "@zervo/ui";

export default function SimilarTransactionsFound({ count, transactions, criteria, categoryName, categoryGroups, onEditCategory, onConfirm, onClose, onCategorizeOnly }) {
  const [currentRules, setCurrentRules] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Initialize rules from criteria
  useEffect(() => {
    if (criteria) {
      const initialRules = [{
        id: Date.now(),
        field: criteria.field || 'merchant_name',
        operator: criteria.operator || 'is',
        value: criteria.value || '',
      }];

      if (criteria.matchType === 'exact' && criteria.amount !== null) {
        initialRules.push({
          id: Date.now() + 1,
          field: 'amount',
          operator: 'equals',
          value: String(Math.abs(criteria.amount)),
        });
      }

      setCurrentRules(initialRules);
    }
  }, [criteria]);

  // Initialize selection with all transactions
  useEffect(() => {
    if (transactions) {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  }, [transactions]);

  const toggleSelection = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds), currentRules);
  };

  return (
    <div className="min-h-full flex flex-col bg-[var(--color-bg)]">
      <div className="flex-1 px-5 pt-2 pb-6 space-y-8">

        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h4 className="text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider">
              Transactions
            </h4>
            <span className="text-[11px] text-[var(--color-muted)] tabular-nums">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="space-y-1 -mx-2">
            {transactions && transactions.map((transaction, index) => (
              <TransactionRow
                key={transaction.id || index}
                transaction={transaction}
                selectable={true}
                selected={selectedIds.has(transaction.id)}
                onSelect={() => toggleSelection(transaction.id)}
                onTransactionClick={() => { }}
                compact={true}
                showDate={true}
              />
            ))}
          </div>
        </div>

        <RuleBuilder
          criteria={criteria}
          initialConditions={currentRules}
          categoryName={categoryName}
          categoryGroups={categoryGroups}
          onEditCategory={onEditCategory}
          onRuleChange={setCurrentRules}
        />
      </div>

      <div className="sticky bottom-0 px-5 py-4 border-t border-[var(--color-border)]/40 bg-[var(--color-bg)] flex items-center justify-end gap-3 z-10">
        <OverlayButton
          variant="secondary"
          onClick={onCategorizeOnly}
        >
          Just this one
        </OverlayButton>
        <OverlayButton
          onClick={handleConfirm}
          disabled={selectedIds.size === 0}
        >
          Confirm
        </OverlayButton>
      </div>
    </div>
  );
}
