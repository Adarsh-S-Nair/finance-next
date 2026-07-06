"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePlaidConnectionErrors } from "../../lib/hooks/usePlaidConnectionErrors";
import { usePlaidReauth } from "../../lib/hooks/usePlaidReauth";

/**
 * ReconnectBanner — accounts page.
 *
 * A broken Plaid connection (typically ITEM_LOGIN_REQUIRED, after a bank
 * password/MFA/session change) silently stops syncing. This surfaces it as a
 * flat panel with a one-click re-auth, styled to the app's system: no card
 * chrome, a warn-colored tone rail flush to the left edge, a rounded action
 * button. Renders nothing when every connection is healthy.
 *
 * Clicking Reconnect opens Plaid Link's native overlay directly (via
 * usePlaidReauth) — no intermediate modal of our own. The dashboard surfaces
 * the same signal as a row inside the AssistantPanel; both read from
 * usePlaidConnectionErrors().
 */
export default function ReconnectBanner({ className = "" }) {
  const { errors, refetch } = usePlaidConnectionErrors();
  const { launch, pendingItemId } = usePlaidReauth(refetch);

  const single = errors.length === 1;

  return (
    <AnimatePresence initial={false}>
      {errors.length > 0 && (
        <motion.div
          key="reconnect-banner"
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.7, 0.3, 1] }}
          className={className}
        >
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
                  {single ? "" : "s"} — usually a password, MFA, or security
                  change. New transactions and balances stay paused until you
                  sign in again.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {errors.map((err) => (
                  <button
                    key={err.id}
                    type="button"
                    disabled={pendingItemId === err.id}
                    onClick={() => launch(err.id)}
                    className="inline-flex h-9 items-center rounded-full bg-[var(--color-fg)] px-4 text-sm font-medium text-[var(--color-bg)] transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
                  >
                    {pendingItemId === err.id
                      ? "Opening…"
                      : single
                        ? "Reconnect"
                        : `Reconnect ${err.bank}`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
