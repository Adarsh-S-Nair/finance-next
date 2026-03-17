"use client";

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { FiCheckCircle, FiLoader, FiXCircle } from 'react-icons/fi';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { useUser } from './providers/UserProvider';
import { useAccounts } from './providers/AccountsProvider';

const ACCOUNT_TYPES = [
  {
    id: 'checking_savings',
    label: 'Checking & savings',
    description: 'Bank accounts for balances, cash flow, and transactions',
  },
  {
    id: 'credit_card',
    label: 'Credit cards',
    description: 'Track card balances, spending, and payment activity',
  },
  {
    id: 'investment',
    label: 'Investments',
    description: 'Brokerage, IRA, 401(k), and other investment accounts',
  },
];

function AccountTypeRow({ accountType, selected, onSelect, disabled }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(accountType)}
      disabled={disabled}
      className={`flex w-full cursor-pointer items-start justify-between gap-4 border-b border-zinc-200 py-4 text-left transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50'
      }`}
    >
      <div>
        <div className="text-sm font-semibold text-zinc-900">{accountType.label}</div>
        <div className="mt-1 text-sm leading-6 text-zinc-600">{accountType.description}</div>
      </div>
      <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${selected ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-transparent'}`}>
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    </button>
  );
}

export default function PlaidLinkModal({ isOpen, onClose, defaultAccountType = null, onSuccess: onSuccessCallback = null }) {
  const { user } = useUser();
  const { addAccount, refreshAccounts } = useAccounts();
  const [selectedAccountType, setSelectedAccountType] = useState(null);
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSelectedAccountType(null);
      setLinkToken(null);
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen]);

  const onSuccess = async (publicToken) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicToken,
          userId: user.id,
          accountType: selectedAccountType?.id || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange token');
      }

      const data = await response.json();

      if (data.accounts) {
        data.accounts.forEach((account) => addAccount(account));
      }

      await refreshAccounts();
      onSuccessCallback?.(data);
      setSuccess(true);

      if (defaultAccountType) {
        onClose();
        setSuccess(false);
        setLinkToken(null);
      } else {
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setLinkToken(null);
        }, 1200);
      }
    } catch (err) {
      console.error('Error exchanging token:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onExit = (err) => {
    if (err) {
      console.error('Plaid Link error:', err);
      setError(err.message || 'An error occurred during account linking');
      if (defaultAccountType) onClose();
    }
    setLoading(false);
  };

  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess, onExit });

  useEffect(() => {
    if (linkToken && ready && !error) {
      setLoading(false);
      open();
    }
  }, [linkToken, ready, error, open]);

  const fetchLinkTokenAndOpen = async (accountType) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, accountType }),
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (err) {
      console.error('Error fetching link token:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && defaultAccountType && !selectedAccountType && !linkToken && !loading && !error) {
      const accountType = ACCOUNT_TYPES.find((type) => type.id === defaultAccountType);
      if (accountType) {
        setSelectedAccountType(accountType);
        fetchLinkTokenAndOpen(accountType.id);
      }
    }
  }, [isOpen, defaultAccountType, selectedAccountType, linkToken, loading, error]);

  const handleClose = () => {
    onClose();
    setError(null);
    setSuccess(false);
    setLinkToken(null);
    setSelectedAccountType(null);
    setLoading(false);
  };

  const handleRetry = async () => {
    setError(null);
    if (selectedAccountType) {
      await fetchLinkTokenAndOpen(selectedAccountType.id);
    }
  };

  const handleConnect = async () => {
    if (selectedAccountType) {
      await fetchLinkTokenAndOpen(selectedAccountType.id);
    }
  };

  if (defaultAccountType) return null;

  const footer = success ? (
    <Button onClick={handleClose} className="w-full">Close</Button>
  ) : error ? (
    <div className="flex w-full gap-2">
      <Button variant="outline" onClick={handleRetry} className="flex-1">Try again</Button>
      <Button variant="outline" onClick={handleClose} className="flex-1">Cancel</Button>
    </div>
  ) : (
    <div className="flex w-full gap-2">
      <Button variant="outline" onClick={handleClose} className="flex-1" disabled={loading}>Cancel</Button>
      <Button onClick={handleConnect} disabled={!selectedAccountType || loading} className="flex-1">
        {loading ? (
          <>
            <FiLoader className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          'Continue'
        )}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Connect an account"
      description="Choose what you want to connect first. You can always add more later."
      size="md"
      footer={footer}
      className="sm:max-w-xl"
    >
      <div className="pt-1">
        {loading && (
          <div className="flex items-center justify-center py-10">
            <div className="text-center">
              <FiLoader className="mx-auto mb-3 h-8 w-8 animate-spin text-zinc-900" />
              <p className="text-sm text-zinc-500">Preparing secure connection...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <FiXCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />
              <div>
                <div className="text-sm font-medium text-red-700">Connection failed</div>
                <p className="mt-1 text-sm text-red-600">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <FiCheckCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
              <div>
                <div className="text-sm font-medium text-emerald-800">Account connected</div>
                <p className="mt-1 text-sm text-emerald-700">Your data is syncing now.</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && !success && (
          <div className="border-t border-zinc-200">
            {ACCOUNT_TYPES.map((accountType) => (
              <AccountTypeRow
                key={accountType.id}
                accountType={accountType}
                selected={selectedAccountType?.id === accountType.id}
                onSelect={setSelectedAccountType}
                disabled={loading}
              />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
