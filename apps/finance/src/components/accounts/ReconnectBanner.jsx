"use client";

import { useState } from "react";
import { useAccounts } from "../providers/AccountsProvider";
import { usePlaidConnectionErrors } from "../../lib/hooks/usePlaidConnectionErrors";
import PlaidLinkModal from "../PlaidLinkModal";

/**
 * ReconnectBanner — accounts page.
 *
 * A broken Plaid connection (typically ITEM_LOGIN_REQUIRED, after a bank
 * password/MFA/session change) silently stops syncing. This surfaces it as a
 * flat panel with a one-click re-auth, styled to the app's system: no card
 * chrome, a warn-colored tone rail as the only accent, square action buttons.
 * Renders nothing when every connection is healthy.
 *
 * The dashboard uses a different surface for the same signal (a row inside the
 * AssistantPanel) — both read from usePlaidConnectionErrors().
 */
export default function ReconnectBanner({ className = "" }) {
  const { refreshAccounts } = useAccounts();
  const { errors, refetch } = usePlaidConnectionErrors();
  const [reconnectItemId, setReconnectItemId] = useState(null);

  if (errors.length === 0) return null;

  const single = errors.length === 1;

  const handleReconnected = () => {
    setReconnectItemId(null);
    refreshAccounts();
    refetch();
  };

  const reconnectBank = reconnectItemId
    ? errors.find((e) => e.id === reconnectItemId)?.bank
    : null;

  return (
    <div className={className}>
      <div className="relative overflow-hidden bg-[var(--color-surface-alt)]">
        {/* Tone rail: flush to the banner's left edge, full height. */}
        <span
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--color-warn)]"
        />
        <div className="flex flex-col gap-3 p-4 pl-5 sm:flex-row sm:items-center sm:justify-between sm:p-5 sm:pl-6">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-fg)]">
              {single
                ? `Reconnect ${errors[0].bank}`
                : `${errors.length} connections need attention`}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]">
              {single ? "Your bank" : "Your banks"} ended the connection
              {single ? "" : "s"} — usually a password, MFA, or security change.
              New transactions and balances stay paused until you sign in again.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {errors.map((err) => (
              <button
                key={err.id}
                type="button"
                onClick={() => setReconnectItemId(err.id)}
                className="inline-flex h-9 items-center rounded-full bg-[var(--color-fg)] px-4 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90 cursor-pointer"
              >
                {single ? "Reconnect" : `Reconnect ${err.bank}`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <PlaidLinkModal
        isOpen={reconnectItemId !== null}
        onClose={() => setReconnectItemId(null)}
        onSuccess={handleReconnected}
        plaidItemId={reconnectItemId}
        reauth
        title={`Reconnect ${reconnectBank || "account"}`}
        description="Sign in again to restore this connection and resume syncing."
      />
    </div>
  );
}
