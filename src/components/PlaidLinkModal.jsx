"use client";

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { useUser } from './UserProvider';
import { useAccounts } from './AccountsProvider';
import { FiLoader, FiCheckCircle, FiXCircle } from 'react-icons/fi';

export default function PlaidLinkModal({ isOpen, onClose }) {
  const { user } = useUser();
  const { addAccount, refreshAccounts } = useAccounts();
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Fetch link token when modal opens
  useEffect(() => {
    if (isOpen && user?.id) {
      fetchLinkToken();
    }
  }, [isOpen, user?.id]);

  const fetchLinkToken = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (err) {
      console.error('Error fetching link token:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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
  };

  const config = {
    token: linkToken,
    onSuccess,
    onExit,
  };

  const { open, ready } = usePlaidLink(config);

  const handleOpenPlaid = () => {
    if (ready && linkToken) {
      open();
    }
  };

  const handleClose = () => {
    onClose();
    setError(null);
    setSuccess(false);
    setLinkToken(null);
  };

  const handleRetry = () => {
    setError(null);
    fetchLinkToken();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Connect Bank Account"
      description="Securely link your bank account to track your finances"
      size="md"
    >
      <div className="space-y-4">
        {loading && !linkToken && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <FiLoader className="h-8 w-8 animate-spin text-[var(--color-accent)] mx-auto mb-2" />
              <p className="text-[var(--color-muted)]">Preparing secure connection...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-4">
            <FiXCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Connection Failed</h3>
            <p className="text-[var(--color-muted)] mb-4">{error}</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={handleRetry}>
                Try Again
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {success && (
          <div className="text-center py-4">
            <FiCheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Success!</h3>
            <p className="text-[var(--color-muted)]">Your account has been connected successfully and transactions are being synced.</p>
          </div>
        )}

        {linkToken && !error && !success && (
          <div className="text-center py-4">
            <div className="mx-auto w-16 h-16 bg-[color-mix(in_oklab,var(--color-accent),transparent_90%)] rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-[var(--color-accent)]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h3 className="text-lg font-medium text-[var(--color-fg)] mb-2">Ready to Connect</h3>
            <p className="text-[var(--color-muted)] mb-6">
              Click the button below to securely connect your bank account through Plaid.
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={handleOpenPlaid} disabled={!ready || loading}>
                {loading ? (
                  <>
                    <FiLoader className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect with Plaid'
                )}
              </Button>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
