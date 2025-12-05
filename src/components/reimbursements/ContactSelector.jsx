import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { FiPlus, FiUser } from 'react-icons/fi';

export default function ContactSelector({ onSelect, selectedContactId }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newContactName, setNewContactName] = useState('');

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .order('name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!newContactName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('contacts')
        .insert([{ name: newContactName.trim(), user_id: user.id }])
        .select()
        .single();

      if (error) throw error;

      setContacts([...contacts, data]);
      onSelect(data.id);
      setNewContactName('');
      setIsAdding(false);
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  };

  if (loading) return <div className="animate-pulse h-10 bg-gray-200 rounded"></div>;

  if (isAdding) {
    return (
      <div className="flex gap-2">
        <input
          type="text"
          value={newContactName}
          onChange={(e) => setNewContactName(e.target.value)}
          placeholder="Contact Name"
          className="flex-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && handleAddContact()}
        />
        <button
          onClick={handleAddContact}
          className="bg-[var(--color-accent)] text-white px-3 py-2 rounded-lg text-sm font-medium"
        >
          Add
        </button>
        <button
          onClick={() => setIsAdding(false)}
          className="text-[var(--color-muted)] px-2 text-sm"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {contacts.map(contact => (
          <button
            key={contact.id}
            onClick={() => onSelect(contact.id)}
            className={`flex items-center gap-2 p-2 rounded-lg border text-sm transition-all ${selectedContactId === contact.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 text-[var(--color-fg)]'
              }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${selectedContactId === contact.id ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
              }`}>
              <FiUser className="w-3 h-3" />
            </div>
            <span className="truncate">{contact.name}</span>
          </button>
        ))}

        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-2 p-2 rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-fg)] transition-all text-sm"
        >
          <FiPlus className="w-4 h-4" />
          <span>Add New</span>
        </button>
      </div>
    </div>
  );
}
