"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { FiCheckCircle, FiLoader, FiXCircle } from 'react-icons/fi';
import { useUser } from './providers/UserProvider';
import { useAccounts } from './providers/AccountsProvider';
import { authFetch } from '../lib/api/fetch';
import { Button, Modal } from "@zervo/ui";

export default function PlaidLinkModal({ isOpen, onClose, onSuccess: onSuccessCallback = null, onUpgradeNeeded = null, plaidItemId = null }) {
  const { user } = useUser();
  const { addAccount, refreshAccounts } = useAccounts();
  const [linkToken, setLinkToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  // Track the plaidItemId returned from link-token in update mode
  const [activePlaidItemId, setActivePlaidItemId] = useState(plaidItemId);
  // Handle for the "close after success" delay. We hold it so we can
  // cancel it if the modal is closed or the component unmounts before
  // the delay elapses — otherwise setState fires on a dead component.
  const successCloseTimerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setLinkToken(null);
      setError(null);
      setSuccess(false);
      setLoading(false);
      setActivePlaidItemId(plaidItemId);
      if (successCloseTimerRef.current) {
        clearTimeout(successCloseTimerRef.current);
        successCloseTimerRef.current = null;
      }
    }
  }, [isOpen, plaidItemId]);

  // Cancel any in-flight success-close timer on unmount.
  useEffect(() => {
    return () => {
      if (successCloseTimerRef.current) {
        clearTimeout(successCloseTimerRef.current);
        successCloseTimerRef.current = null;
      }
    };
  }, []);

  const exchangeToken = async (publicToken) => {
    try {
      setLoading(true);
      setError(null);

      const body = { publicToken };
      // In update mode, pass the existing plaidItemId so the backend merges rather than creates
      if (activePlaidItemId) {
        body.existingPlaidItemId = activePlaidItemId;
      }

      const response = await authFetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

      // Cancel any prior in-flight timer before starting a new one.
      if (successCloseTimerRef.current) {
        clearTimeout(successCloseTimerRef.current);
      }
      successCloseTimerRef.current = setTimeout(() => {
        successCloseTimerRef.current = null;
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
      const errorMessage = err.display_message || err.error_message || err.message || 'An error occurred during account linking';
      console.error('Plaid error details:', {
        error_type: err.error_type,
        error_code: err.error_code,
        error_message: err.error_message,
        display_message: err.display_message,
      });
      setError(errorMessage);
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

  const fetchLinkTokenAndOpen = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const linkTokenBody = {};
      // If a plaidItemId was passed as prop, request update mode (for pro upgrades adding investments)
      if (activePlaidItemId) {
        linkTokenBody.plaidItemId = activePlaidItemId;
        linkTokenBody.additionalProducts = ['investments'];
      }

      const response = await authFetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(linkTokenBody),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        if (response.status === 403 && errorBody.error === 'connection_limit') {
          setLoading(false);
          onClose();
          onUpgradeNeeded?.();
          return;
        }
        throw new Error(errorBody.error || 'Failed to create link token');
      }

      const data = await response.json();

      // Capture plaidItemId from update mode response so exchange-token can merge correctly
      if (data.plaidItemId) {
        setActivePlaidItemId(data.plaidItemId);
      }

      setLinkToken(data.link_token);
    } catch (err) {
      console.error('Error fetching link token:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [activePlaidItemId, onClose, onUpgradeNeeded]);

  // Automatically fetch link token when modal opens
  useEffect(() => {
    if (isOpen && !linkToken && !loading && !error && !success) {
      fetchLinkTokenAndOpen();
    }
  }, [isOpen, linkToken, loading, error, success, fetchLinkTokenAndOpen]);

  const handleClose = () => {
    onClose();
    setError(null);
    setSuccess(false);
    setLinkToken(null);
    setLoading(false);
    setActivePlaidItemId(plaidItemId);
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
  );
}
