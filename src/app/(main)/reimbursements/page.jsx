'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import Card from '../../../components/ui/Card';
import { FiUser } from 'react-icons/fi';
import clsx from 'clsx';

export default function ReimbursementsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReimbursements();
  }, []);

  const fetchReimbursements = async () => {
    try {
      // Fetch contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*');

      if (contactsError) throw contactsError;

      // Fetch all active splits (debts)
      const { data: splitsData, error: splitsError } = await supabase
        .from('transaction_splits')
        .select(`
          id,
          amount,
          contact_id,
          is_settled,
          transaction_repayments (
            amount
          )
        `)
        .eq('is_settled', false);

      if (splitsError) throw splitsError;

      // Calculate balances per contact
      const contactBalances = contactsData.map(contact => {
        const contactSplits = splitsData.filter(s => s.contact_id === contact.id);
        const totalOwed = contactSplits.reduce((sum, split) => {
          const repaid = split.transaction_repayments.reduce((rSum, r) => rSum + r.amount, 0);
          return sum + (split.amount - repaid);
        }, 0);

        return {
          ...contact,
          balance: totalOwed
        };
      }).sort((a, b) => b.balance - a.balance);

      setContacts(contactBalances);
    } catch (error) {
      console.error('Error fetching reimbursements:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalOwed = contacts.reduce((sum, c) => sum + c.balance, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-[var(--color-fg)]">Reimbursements</h1>
        <p className="text-[var(--color-muted)]">Track who owes you money.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Summary Card */}
        <Card className="md:col-span-3 bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-bg)] border-[var(--color-border)]">
          <div className="p-6 flex flex-col items-center justify-center text-center">
            <span className="text-sm font-medium text-[var(--color-muted)] uppercase tracking-wider">Total Owed to You</span>
            <div className="text-4xl font-bold text-[var(--color-fg)] mt-2">
              ${totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </Card>

        {/* Contact Cards */}
        {loading ? (
          [...Array(3)].map((_, i) => (
            <div key={i} className="h-32 bg-[var(--color-surface)] animate-pulse rounded-xl" />
          ))
        ) : contacts.length === 0 ? (
          <div className="md:col-span-3 text-center py-12 text-[var(--color-muted)]">
            No active reimbursements found.
          </div>
        ) : (
          contacts.map(contact => (
            <Card key={contact.id} className="hover:border-[var(--color-accent)]/50 transition-colors group cursor-pointer">
              <div className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] flex items-center justify-center text-xl">
                    <FiUser />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--color-fg)]">{contact.name}</h3>
                    <p className="text-sm text-[var(--color-muted)]">
                      {contact.balance > 0 ? 'Owes you' : 'Settled'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={clsx(
                    "font-bold text-lg",
                    contact.balance > 0 ? "text-[var(--color-fg)]" : "text-[var(--color-muted)]"
                  )}>
                    ${contact.balance.toFixed(2)}
                  </div>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
