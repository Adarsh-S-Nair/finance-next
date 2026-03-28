"use client";

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { FiCheckCircle, FiLoader, FiXCircle } from 'react-icons/fi';
import Modal from './ui/Modal';
import Button from './ui/Button';
import MockPlaidLink from './MockPlaidLink';
import { useUser } from './providers/UserProvider';
import { useAccounts } from './providers/AccountsProvider';
import { authFetch } from '../lib/api/fetch';

const isMockPlaid = process.env.NEXT_PUBLIC_PLAID_ENV === 'mock';

export default function PlaidLinkModal({ isOpen, onClose, onSuccess: onSuccessCallback = null }) {
  const { user } = useUser();
  const { addAccount, refreshAccounts } = useAccounts();
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showMockPicker, setShowMockPicker] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setLinkToken(null);
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen]);

  const exchangeToken = async (publicToken) => {
    try {
      setLoading(true);
      setError(null);
      setShowMockPicker(false);

      const response = await authFetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicToken }),
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

      setTimeout(() => {
        onClose();
        setSuccess(false);
        setLinkToken(null);
      }, 1200);
    } catch (err) {
      console.error('Error exchanging token:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const onSuccess = async (publicToken) => {
    await exchangeToken(publicToken);
  };

  const onExit = (err) => {
    if (err) {
      console.error('Plaid Link error:', err);
      setError(err.message || 'An error occurred during account linking');
    }
    setLoading(false);
  };

  const handleMockExit = () => {
    setShowMockPicker(false);
    setLoading(false);
  };

  const { open, ready } = usePlaidLink({ token: isMockPlaid ? null : linkToken, onSuccess, onExit });

  useEffect(() => {
    if (!isMockPlaid && linkToken && ready && !error) {
      setLoading(false);
      open();
    }
  }, [linkToken, ready, error, open]);

  const fetchLinkTokenAndOpen = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await authFetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const data = await response.json();

      if (isMockPlaid) {
        setLoading(false);
        setShowMockPicker(true);
      } else {
        setLinkToken(data.link_token);
      }
    } catch (err) {
      console.error('Error fetching link token:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  // Automatically fetch link token when modal opens
  useEffect(() => {
    if (isOpen && !linkToken && !loading && !error && !success) {
      fetchLinkTokenAndOpen();
    }
  }, [isOpen]);

  const handleClose = () => {
    onClose();
    setError(null);
    setSuccess(false);
    setLinkToken(null);
    setLoading(false);
    setShowMockPicker(false);
  };

  const handleRetry = async () => {
    setError(null);
    await fetchLinkTokenAndOpen();
  };

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
    </div>
  );

  return (
    <>
      {/* Mock institution picker — rendered outside the Modal so it can cover everything */}
      {isMockPlaid && showMockPicker && (
        <MockPlaidLink
          onSuccess={(token) => exchangeToken(token)}
          onExit={handleMockExit}
        />
      )}
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Connect an account"
      description="Securely connect your bank, credit card, or investment accounts."
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
          <div className="rounded-xl border border-[color-mix(in_oklab,var(--color-danger),transparent_80%)] bg-[color-mix(in_oklab,var(--color-danger),transparent_95%)] p-4">
            <div className="flex items-start gap-3">
              <FiXCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-danger)]" />
              <div>
                <div className="text-sm font-medium text-[var(--color-danger)]">Connection failed</div>
                <p className="mt-1 text-sm text-[var(--color-danger)]">{error}</p>
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
      </div>
    </Modal>
    </>
  );
}
