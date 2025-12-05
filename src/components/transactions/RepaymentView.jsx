import { useState, useEffect } from 'react';
import ContactSelector from '../reimbursements/ContactSelector';
import { supabase } from '../../lib/supabaseClient';
import Button from '../ui/Button';

export default function RepaymentView({ transaction, onRepaymentCreated, onClose }) {
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [debts, setDebts] = useState([]);
  const [allocations, setAllocations] = useState({}); // { split_id: amount }
  const [loading, setLoading] = useState(false);
  const [fetchingDebts, setFetchingDebts] = useState(false);

  useEffect(() => {
    if (selectedContactId) {
      fetchDebts(selectedContactId);
    } else {
      setDebts([]);
      setAllocations({});
    }
  }, [selectedContactId]);

  const fetchDebts = async (contactId) => {
    setFetchingDebts(true);
    try {
      const { data, error } = await supabase
        .from('transaction_splits')
        .select(`
          id,
          amount,
          created_at,
          transactions (
            description,
            date,
            datetime
          ),
          transaction_repayments (
            amount
          )
        `)
        .eq('contact_id', contactId)
        .eq('is_settled', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Calculate remaining balance for each debt
      const activeDebts = data.map(split => {
        const totalRepaid = split.transaction_repayments.reduce((sum, r) => sum + r.amount, 0);
        const remaining = split.amount - totalRepaid;
        return { ...split, remaining };
      }).filter(d => d.remaining > 0);

      setDebts(activeDebts);

      // Auto-allocate logic
      autoAllocate(activeDebts, transaction?.amount || 0);

    } catch (error) {
      console.error('Error fetching debts:', error);
    } finally {
      setFetchingDebts(false);
    }
  };

  const autoAllocate = (currentDebts, totalAmount) => {
    let remainingToAllocate = totalAmount;
    const newAllocations = {};

    for (const debt of currentDebts) {
      if (remainingToAllocate <= 0) break;
      // Allocate up to the debt remaining, but not more than what we have left
      const allocate = Math.min(debt.remaining, remainingToAllocate);
      // Round to 2 decimals to avoid float issues
      const roundedAllocate = Math.round(allocate * 100) / 100;

      if (roundedAllocate > 0) {
        newAllocations[debt.id] = roundedAllocate;
        remainingToAllocate -= roundedAllocate;
      }
    }
    setAllocations(newAllocations);
  };

  const handleAllocationChange = (splitId, value) => {
    const numValue = parseFloat(value) || 0;
    setAllocations(prev => ({ ...prev, [splitId]: numValue }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const repaymentInserts = Object.entries(allocations)
        .filter(([_, amount]) => amount > 0)
        .map(([splitId, amount]) => ({
          repayment_transaction_id: transaction.id,
          split_id: splitId,
          amount: amount
        }));

      if (repaymentInserts.length === 0) return;

      const { error } = await supabase
        .from('transaction_repayments')
        .insert(repaymentInserts);

      if (error) throw error;

      // Update is_settled for fully paid debts
      for (const [splitId, amount] of Object.entries(allocations)) {
        const debt = debts.find(d => d.id === splitId);
        if (debt && Math.abs(debt.remaining - amount) < 0.01) {
          await supabase
            .from('transaction_splits')
            .update({ is_settled: true })
            .eq('id', splitId);
        }
      }

      if (onRepaymentCreated) onRepaymentCreated();
      if (onClose) onClose();
    } catch (error) {
      console.error('Error creating repayment:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalAllocated = Object.values(allocations).reduce((sum, val) => sum + val, 0);
  const unallocated = (transaction?.amount || 0) - totalAllocated;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-[var(--color-muted)] mb-2">Who is paying?</label>
        <ContactSelector selectedContactId={selectedContactId} onSelect={setSelectedContactId} />
      </div>

      {selectedContactId && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-[var(--color-fg)]">Outstanding Debts</h4>
          {fetchingDebts ? (
            <div className="text-sm text-[var(--color-muted)]">Loading debts...</div>
          ) : debts.length === 0 ? (
            <div className="text-sm text-[var(--color-muted)]">No outstanding debts found.</div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2 border border-[var(--color-border)] rounded-lg p-2">
              {debts.map(debt => (
                <div key={debt.id} className="flex items-center justify-between gap-2 p-2 bg-[var(--color-surface)] rounded">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{debt.transactions?.description || 'Expense'}</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {new Date(debt.transactions?.date || debt.created_at).toLocaleDateString()} • Owed: ${debt.remaining.toFixed(2)}
                    </div>
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      value={allocations[debt.id] || ''}
                      onChange={(e) => handleAllocationChange(debt.id, e.target.value)}
                      className="w-full px-2 py-1 text-right text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
                      placeholder="0.00"
                      max={debt.remaining}
                      step="0.01"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between text-sm pt-2 border-t border-[var(--color-border)]">
            <span className="text-[var(--color-muted)]">Unallocated:</span>
            <span className={unallocated < -0.01 ? 'text-red-500' : 'text-[var(--color-fg)]'}>
              ${unallocated.toFixed(2)}
            </span>
          </div>
        </div>
      )}

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
          disabled={loading || totalAllocated === 0}
        >
          {loading ? 'Saving...' : 'Save Allocation'}
        </Button>
      </div>
    </div>
  );
}
