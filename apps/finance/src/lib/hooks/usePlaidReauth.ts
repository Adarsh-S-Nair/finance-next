"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useAccounts } from "../../components/providers/AccountsProvider";
import { authFetch } from "../api/fetch";

/**
 * Headless Plaid re-authentication.
 *
 * Unlike <PlaidLinkModal>, this renders no chrome of its own: calling
 * `launch(plaidItemId)` fetches a re-auth link token (update mode, no new
 * product consent) and opens Plaid Link's native overlay directly. Plaid's
 * own modal + spinner is the only surface the user sees — we don't stack our
 * own modal on top of it.
 *
 * `onDone` fires after a successful re-auth (post token exchange); accounts
 * are already refreshed by then. `pendingItemId` is the item currently being
 * launched, so a trigger can show a lightweight "Opening…" state during the
 * brief token-fetch gap before Plaid takes over.
 */
export function usePlaidReauth(onDone?: () => void): {
  launch: (plaidItemId: string) => void;
  pendingItemId: string | null;
} {
  const { refreshAccounts } = useAccounts();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const reset = useCallback(() => {
    setLinkToken(null);
    setActiveItemId(null);
  }, []);

  const handleSuccess = useCallback(
    async (publicToken: string) => {
      try {
        await authFetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicToken,
            existingPlaidItemId: activeItemId,
          }),
        });
        await refreshAccounts();
        onDone?.();
      } catch (err) {
        console.error("[usePlaidReauth] token exchange failed:", err);
      } finally {
        reset();
      }
    },
    [activeItemId, refreshAccounts, onDone, reset],
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken: string) => {
      void handleSuccess(publicToken);
    },
    onExit: () => reset(),
  });

  // Open Plaid Link the moment the fetched token is ready.
  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  const launch = useCallback(async (plaidItemId: string) => {
    if (!plaidItemId) return;
    setActiveItemId(plaidItemId);
    try {
      const res = await authFetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaidItemId, reauth: true }),
      });
      if (!res.ok) throw new Error(`link-token failed (${res.status})`);
      const data = await res.json();
      setLinkToken(data.link_token);
    } catch (err) {
      console.error("[usePlaidReauth] launch failed:", err);
      setActiveItemId(null);
    }
  }, []);

  return { launch, pendingItemId: activeItemId };
}
