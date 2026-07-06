"use client";

import { useState, useEffect, useCallback } from "react";
import { FiAlertTriangle } from "react-icons/fi";
import { Button } from "@zervo/ui";
import { useUser } from "../providers/UserProvider";
import { useAccounts } from "../providers/AccountsProvider";
import { authFetch } from "../../lib/api/fetch";
import { supabase } from "../../lib/supabase/client";
import PlaidLinkModal from "../PlaidLinkModal";

/**
 * ReconnectBanner
 *
 * Surfaces Plaid connections that have fallen into an error state
 * (typically ITEM_LOGIN_REQUIRED — the bank invalidated the connection after
 * a password/MFA/session change) and gives the user a one-click path to
 * re-authenticate via Plaid Link's update mode.
 *
 * Before this existed, an errored item silently stopped syncing: the accounts
 * page used /api/plaid/sync-status only to drive the "Syncing…" pill and threw
 * the `itemsError` count away, so a broken connection produced no banner, no
 * prompt — balances and transactions just quietly went stale and it looked
 * like the whole app had frozen.
 *
 * Self-contained: fetches its own sync-status, maps errored item ids to their
 * institution name via useAccounts(), and refetches on any plaid_items change
 * (Realtime) so the banner disappears the moment a reconnect succeeds and the
 * webhook flips sync_status back to 'idle'. Renders nothing when everything is
 * healthy, so it's safe to drop in at the top of any page.
 */
export default function ReconnectBanner({ className = "" }) {
  const { user } = useUser();
  const { allAccounts, refreshAccounts } = useAccounts();
  // Errored plaid_items: [{ id, last_error }]
  const [erroredItems, setErroredItems] = useState([]);
  // The plaid_item_id currently being reconnected (drives the modal).
  const [reconnectItemId, setReconnectItemId] = useState(null);

  const fetchErrored = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await authFetch("/api/plaid/sync-status");
      if (!res.ok) return;
      const data = await res.json();
      const errored = (data.items || [])
        .filter((it) => it.sync_status === "error")
        .map((it) => ({ id: it.id, last_error: it.last_error }));
      setErroredItems(errored);
    } catch (err) {
      console.warn("[ReconnectBanner] sync-status fetch failed:", err);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchErrored();
  }, [fetchErrored]);

  // Refetch whenever plaid_items changes — catches the reconnect webhook
  // flipping status back to 'idle' (banner vanishes) and any fresh error
  // arriving (banner appears) without a polling loop.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`reconnect-banner-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "plaid_items",
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchErrored()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchErrored]);

  // Map a plaid_item_id to a human-friendly institution name from the
  // already-loaded accounts. Falls back to a generic label if the accounts
  // list hasn't populated yet.
  const bankNameForItem = useCallback(
    (itemId) => {
      const match = (allAccounts || []).find((a) => a.plaidItemId === itemId);
      return match?.bank || "your bank";
    },
    [allAccounts]
  );

  if (erroredItems.length === 0) return null;

  const handleReconnected = () => {
    setReconnectItemId(null);
    // Pull fresh accounts + re-evaluate error state. Realtime will also
    // fire, but this makes the banner feel instantly responsive.
    refreshAccounts();
    fetchErrored();
  };

  return (
    <div className={className}>
      <div className="rounded-2xl border border-[color-mix(in_oklab,var(--color-warn),transparent_55%)] bg-[color-mix(in_oklab,var(--color-warn),transparent_88%)] p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--color-warn),transparent_78%)]">
            <FiAlertTriangle className="h-5 w-5 text-[var(--color-fg)]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[var(--color-fg)]">
              {erroredItems.length === 1
                ? `Reconnect ${bankNameForItem(erroredItems[0].id)}`
                : `${erroredItems.length} connections need attention`}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              {erroredItems.length === 1
                ? "Your bank ended the connection (usually a password, MFA, or security change). New transactions and balances have paused until you sign in again."
                : "Your bank ended these connections (usually a password, MFA, or security change). New transactions and balances have paused until you sign in again."}
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {erroredItems.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  onClick={() => setReconnectItemId(item.id)}
                >
                  {erroredItems.length === 1
                    ? "Reconnect"
                    : `Reconnect ${bankNameForItem(item.id)}`}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <PlaidLinkModal
        isOpen={reconnectItemId !== null}
        onClose={() => setReconnectItemId(null)}
        onSuccess={handleReconnected}
        plaidItemId={reconnectItemId}
        reauth
        title={`Reconnect ${reconnectItemId ? bankNameForItem(reconnectItemId) : "account"}`}
        description="Sign in again to restore this connection and resume syncing."
      />
    </div>
  );
}
