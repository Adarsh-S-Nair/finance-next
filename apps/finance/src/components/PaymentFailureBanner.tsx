"use client";

import { useState } from "react";
import { FiAlertTriangle, FiX } from "react-icons/fi";
import { useUser } from "./providers/UserProvider";
import { authFetch } from "../lib/api/fetch";

const PAYMENT_ISSUE_STATUSES = ["past_due", "unpaid", "incomplete"];

export default function PaymentFailureBanner() {
  const { subscriptionStatus, isPro } = useUser();
  const [dismissed, setDismissed] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  // Only show for users who had a subscription but have a payment issue
  if (
    dismissed ||
    !subscriptionStatus ||
    !PAYMENT_ISSUE_STATUSES.includes(subscriptionStatus)
  ) {
    return null;
  }

  const handleFixPayment = async () => {
    setPortalLoading(true);
    try {
      const res = await authFetch("/api/stripe/portal", { method: "POST" });
      const body = await res.json();
      if (body.url) {
        window.location.href = body.url;
        return;
      }
    } catch {
      // Swallow — user can try again
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
      <FiAlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
      <span className="text-[var(--color-fg)]">
        {isPro
          ? "There's an issue with your payment. Update your billing info to keep Pro features."
          : "Your subscription payment failed and your account has been downgraded to Free."}
      </span>
      <button
        onClick={handleFixPayment}
        disabled={portalLoading}
        className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline flex-shrink-0 disabled:opacity-50"
      >
        {portalLoading ? "Loading..." : "Fix payment"}
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="p-0.5 rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors flex-shrink-0 ml-1"
        aria-label="Dismiss"
      >
        <FiX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
