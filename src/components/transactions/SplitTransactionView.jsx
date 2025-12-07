import { useState, useEffect } from 'react';
import ContactSelector from '../reimbursements/ContactSelector';
import { supabase } from '../../lib/supabaseClient';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { FiDollarSign, FiCheck } from 'react-icons/fi';
import clsx from 'clsx';

export default function SplitTransactionView({ transaction, onSplitCreated, onClose }) {
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-focus amount or set default? User said "default should be the full amount"
  useEffect(() => {
    if (transaction) {
      setAmount(Math.abs(transaction.amount).toFixed(2));
    }
  }, [transaction]);

  const handleFullAmount = () => {
    if (!transaction) return;
    setAmount(Math.abs(transaction.amount).toFixed(2));
  };

  const handleSplitEvenly = (parts) => {
    if (!transaction) return;
    const splitAmount = (Math.abs(transaction.amount) / parts).toFixed(2);
    setAmount(splitAmount);
  };

  const handleSubmit = async () => {
    if (!selectedContactId || !amount || !transaction) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('transaction_splits')
        .insert({
          transaction_id: transaction.id,
          contact_id: selectedContactId,
          amount: parseFloat(amount),
          is_settled: false
        });

      if (error) throw error;

      // If full amount is reimbursed, mark as handled (not unmatched)
      if (Math.abs(parseFloat(amount) - Math.abs(transaction.amount)) < 0.01) {
        await supabase
          .from('transactions')
          .update({ is_unmatched_transfer: false })
          .eq('id', transaction.id);
      }

      if (onSplitCreated) onSplitCreated();
      if (onClose) onClose();
    } catch (error) {
      console.error('Error creating split:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pt-2">
      <Card variant="glass" padding="none" className="overflow-visible">
        {/* Section: Who Owes */}
        <div className="p-5">
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-4">
            Who owes you?
          </label>
          <ContactSelector
            selectedContactId={selectedContactId}
            onSelect={setSelectedContactId}
          />
        </div>

        {/* Section: Amount */}
        <div className="p-5 border-t border-[var(--color-border)]/40">
          <label className="block text-xs font-medium text-[var(--color-muted)] uppercase tracking-wider mb-4">
            How much?
          </label>

          <div className="flex flex-col gap-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-[var(--color-muted)]">$</span>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-xl font-medium text-[var(--color-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20 focus:border-[var(--color-accent)] transition-all placeholder-[var(--color-muted)]/50"
                placeholder="0.00"
                step="0.01"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleFullAmount}
                className="flex-1 px-3 py-2 text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
              >
                Full Amount
              </button>
              <button
                onClick={() => handleSplitEvenly(2)}
                className="flex-1 px-3 py-2 text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
              >
                ½ Split
              </button>
              <button
                onClick={() => handleSplitEvenly(3)}
                className="flex-1 px-3 py-2 text-xs font-medium bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors"
              >
                ⅓ Split
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="pt-2 flex gap-3">
        <Button
          variant="ghost"
          fullWidth
          onClick={onClose}
          className="h-11"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={handleSubmit}
          disabled={loading || !selectedContactId || !amount}
          className="h-11 justify-center"
        >
          {loading ? 'Sending Request...' : 'Send Request'}
        </Button>
      </div>
    </div>
  );
}
