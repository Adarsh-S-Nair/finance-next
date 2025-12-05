import { useState } from 'react';
import ContactSelector from '../reimbursements/ContactSelector';
import { supabase } from '../../lib/supabaseClient';
import Button from '../ui/Button';

export default function SplitTransactionView({ transaction, onSplitCreated, onClose }) {
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

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

      if (onSplitCreated) onSplitCreated();
      if (onClose) onClose();
    } catch (error) {
      console.error('Error creating split:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[var(--color-muted)] mb-2">
          Who owes you?
        </label>
        <ContactSelector
          selectedContactId={selectedContactId}
          onSelect={setSelectedContactId}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--color-muted)] mb-2">
          Amount
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-muted)]">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              placeholder="0.00"
              step="0.01"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => handleSplitEvenly(2)}
            className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface)] text-[var(--color-muted)] transition-colors"
          >
            ½ Split
          </button>
          <button
            onClick={() => handleSplitEvenly(3)}
            className="px-3 py-1.5 text-xs border border-[var(--color-border)] rounded-md hover:bg-[var(--color-surface)] text-[var(--color-muted)] transition-colors"
          >
            ⅓ Split
          </button>
        </div>
      </div>

      <div className="pt-4 flex gap-3">
        <Button
          variant="outline"
          fullWidth
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          fullWidth
          onClick={handleSubmit}
          disabled={loading || !selectedContactId || !amount}
        >
          {loading ? 'Saving...' : 'Save Split'}
        </Button>
      </div>
    </div>
  );
}
