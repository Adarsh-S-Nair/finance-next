import React, { useState, useEffect } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import Button from '../ui/Button';
import TransactionRow from './TransactionRow';
import Card from '../ui/Card';
import RuleBuilder from './RuleBuilder';

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

      // If matchType is 'exact', also add an amount condition
      if (criteria.matchType === 'exact' && criteria.amount !== null) {
        initialRules.push({
          id: Date.now() + 1,
          field: 'amount',
          operator: 'equals',
          value: String(Math.abs(criteria.amount)), // Use absolute value for display
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
      <div className="flex-1 p-4 space-y-6">

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider px-1">
            Transactions ({selectedIds.size} selected)
          </h4>
          <Card variant="default" padding="none" className="overflow-hidden">
            <div className="divide-y divide-[var(--color-border)]/40">
              {transactions && transactions.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id || index}
                  transaction={transaction}
                  selectable={true}
                  selected={selectedIds.has(transaction.id)}
                  onSelect={() => toggleSelection(transaction.id)}
                  onTransactionClick={() => { }} // No-op for now
                  compact={true}
                  showDate={true}
                />
              ))}
            </div>
          </Card>
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

      <div className="sticky bottom-0 p-4 border-t border-[var(--color-border)]/50 bg-[var(--color-bg)] grid grid-cols-2 gap-3 z-10">
        <Button
          onClick={onCategorizeOnly}
          variant="outline"
          className="w-full justify-center"
          size="lg"
        >
          Categorize Only This
        </Button>
        <Button
          onClick={handleConfirm}
          className="w-full justify-center"
          size="lg"
          disabled={selectedIds.size === 0}
        >
          Confirm & Update
        </Button>
      </div>
    </div>
  );
}
