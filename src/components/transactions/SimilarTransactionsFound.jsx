import React from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import Button from '../ui/Button';
import TransactionRow from './TransactionRow';
import Card from '../ui/Card';

export default function SimilarTransactionsFound({ count, transactions, onClose }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="flex flex-col items-center justify-center space-y-4 pt-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center">
            <FiAlertCircle className="w-8 h-8 text-[var(--color-accent)]" />
          </div>

          <div className="space-y-1 text-center">
            <h3 className="text-lg font-semibold text-[var(--color-fg)]">
              {count} Similar Transactions Found
            </h3>
            <p className="text-sm text-[var(--color-muted)] max-w-xs mx-auto">
              These transactions look similar to the one you just categorized.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wider px-1">
            Transactions
          </h4>
          <Card variant="default" padding="none" className="overflow-hidden">
            <div className="divide-y divide-[var(--color-border)]/40">
              {transactions && transactions.map((transaction, index) => (
                <TransactionRow
                  key={transaction.id || index}
                  transaction={transaction}
                  onTransactionClick={() => { }} // No-op for now
                />
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="p-4 border-t border-[var(--color-border)]/50 bg-[var(--color-bg)]">
        <Button
          onClick={onClose}
          className="w-full justify-center"
          size="lg"
        >
          Done
        </Button>
      </div>
    </div>
  );
}
