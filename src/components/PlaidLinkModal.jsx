"use client";

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import Drawer from './ui/Drawer';
import Button from './ui/Button';
import { useUser } from './UserProvider';
import { useAccounts } from './AccountsProvider';
import { FiLoader, FiCheckCircle, FiXCircle } from 'react-icons/fi';

const ACCOUNT_TYPES = [
  {
    id: 'checking_savings',
    label: 'Checking / Savings',
    description: 'Connect checking, savings, or other deposit accounts',
    product: 'transactions',
  },
  {
    id: 'credit_card',
    label: 'Credit Card',
    description: 'Connect credit card accounts',
    product: 'transactions',
  },
  {
    id: 'investment',
    label: 'Brokerage / Investment',
    description: 'Connect brokerage, 401(k), IRA, or other investment accounts',
    product: 'investments',
  },
];

export default function PlaidLinkModal({ isOpen, onClose }) {
  const { user } = useUser();
  const { addAccount, refreshAccounts } = useAccounts();
  const [selectedAccountType, setSelectedAccountType] = useState(null);
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Reset state when drawer opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedAccountType(null);
      setLinkToken(null);
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen]);

  const onSuccess = async (publicToken, metadata) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicToken,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange token');
      }

      const data = await response.json();
      
      // Add accounts to context
      if (data.accounts) {
        data.accounts.forEach(account => {
          addAccount(account);
        });
      }

      // Refresh accounts to get the latest data including any synced transactions
      await refreshAccounts();

      setSuccess(true);
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setLinkToken(null);
      }, 2000);
    } catch (err) {
      console.error('Error exchanging token:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onExit = (err, metadata) => {
    if (err) {
      console.error('Plaid Link error:', err);
      setError(err.message || 'An error occurred during account linking');
    }
    // Don't close modal on exit, let user retry or close manually
    setLoading(false);
  };

  const config = {
    token: linkToken,
    onSuccess,
    onExit,
  };

  const { open, ready } = usePlaidLink(config);

  // Open Plaid Link when link token is ready
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: user.id,
          accountType: accountType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const data = await response.json();
      setLinkToken(data.link_token);
      // Don't set loading to false here - let the useEffect handle it when Plaid opens
    } catch (err) {
      console.error('Error fetching link token:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleAccountTypeSelect = (accountType) => {
    setSelectedAccountType(accountType);
    setError(null);
  };

  const handleConnect = async () => {
    if (selectedAccountType) {
      await fetchLinkTokenAndOpen(selectedAccountType.id);
    }
  };

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

  // Render account type selection screen
  const renderAccountTypeSelection = () => {
    return (
      <div className="space-y-3 pt-2">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <FiLoader className="h-8 w-8 animate-spin text-[var(--color-accent)] mx-auto mb-2" />
              <p className="text-[var(--color-muted)]">Preparing secure connection...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <FiXCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-500 mb-1">Connection Failed</h3>
                <p className="text-xs text-[var(--color-muted)]">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <FiCheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-green-500 mb-1">Success!</h3>
                <p className="text-xs text-[var(--color-muted)]">Your account has been connected successfully.</p>
              </div>
            </div>
          </div>
        )}

        {!loading && !success && (
          <>
            {ACCOUNT_TYPES.map((accountType) => {
              const isSelected = selectedAccountType?.id === accountType.id;
              return (
                <button
                  key={accountType.id}
                  type="button"
                  onClick={() => handleAccountTypeSelect(accountType)}
                  disabled={loading}
                  className={`w-full p-4 rounded-lg border-2 transition-all text-left cursor-pointer ${
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                      : 'border-[var(--color-border)] hover:border-[var(--color-accent)] hover:bg-[var(--color-surface)]'
                  } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--color-fg)] mb-1">{accountType.label}</h3>
                      <p className="text-xs text-[var(--color-muted)]">
                        {accountType.description}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>
    );
  };

  // Render footer based on state
  const renderFooter = () => {
    if (success) {
      return (
        <Button onClick={handleClose} className="w-full">
          Close
        </Button>
      );
    }

    if (error) {
      return (
        <div className="flex gap-2 w-full">
          <Button variant="outline" onClick={handleRetry} className="flex-1">
            Try Again
          </Button>
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
        </div>
      );
    }

    return (
      <div className="flex gap-2 w-full">
        <Button variant="outline" onClick={handleClose} className="flex-1" disabled={loading}>
          Cancel
        </Button>
        <Button onClick={handleConnect} disabled={!selectedAccountType || loading} className="flex-1">
          {loading ? (
            <>
              <FiLoader className="h-4 w-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            'Connect'
          )}
        </Button>
      </div>
    );
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Connect Account"
      description="What type of account do you want to connect?"
      size="md"
      footer={renderFooter()}
    >
      {renderAccountTypeSelection()}
    </Drawer>
  );
}
