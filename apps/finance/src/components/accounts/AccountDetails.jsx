"use client";

import { useEffect, useRef, useState } from "react";
import { PiBankFill } from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaidLink } from "react-plaid-link";
import clsx from "clsx";
import { Button } from "@zervo/ui";
import { formatAccountSubtype } from "../../lib/accountSubtype";
import { isLiabilityAccount } from "../../lib/accountUtils";
import { formatCurrency as formatCurrencyBase } from "../../lib/formatCurrency";
import { useAccounts } from "../providers/AccountsProvider";
import { authFetch } from "../../lib/api/fetch";
import AccountLiabilitySection from "./AccountLiabilitySection";

const formatCurrency = (amount, currency = "USD") =>
  formatCurrencyBase(amount ?? 0, true, currency || "USD");

const formatDate = (value) => {
  if (!value) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return null;
  }
};

const formatUtilizationPct = (frac) => {
  const pct = frac * 100;
  if (pct === 0) return "0%";
  if (pct >= 10) return `${Math.round(pct)}%`;
  return `${pct.toFixed(1)}%`;
};

const isCreditAccount = (type) => {
  const t = (type || "").toLowerCase();
  return t.includes("credit");
};

function CreditUtilization({ balance, limit, available, currency }) {
  const used = Math.max(balance || 0, 0);
  const utilization = limit > 0 ? Math.min(used / limit, 1) : 0;
  const availableCredit = available != null ? available : Math.max(limit - used, 0);

  const barColor =
    utilization < 0.3
      ? "bg-[var(--color-success)]"
      : utilization < 0.7
      ? "bg-[var(--color-warn)]"
      : "bg-[var(--color-danger)]";

  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xl font-medium text-[var(--color-fg)] tabular-nums tracking-tight">
            {formatCurrency(used, currency)}
          </span>
          <span className="text-xs text-[var(--color-muted)] truncate">
            of {formatCurrency(limit, currency)} limit
          </span>
        </div>
        <span className="text-sm font-medium text-[var(--color-fg)] tabular-nums">
          {formatUtilizationPct(utilization)}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--color-surface-alt)] overflow-hidden">
        <motion.div
          className={clsx("h-full rounded-full", barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${utilization * 100}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
      <div className="mt-2.5 text-xs text-[var(--color-muted)] tabular-nums">
        {formatCurrency(availableCredit, currency)} available
      </div>
    </div>
  );
}

/**
 * Inline "complete this connection" action for a liability account whose
 * Plaid item was linked without the liabilities product. Launches Plaid Link
 * in update mode DIRECTLY (no intermediate modal) to add liabilities consent,
 * then exchanges + refreshes. The existing sync chain pulls APR / statement /
 * due-date data, which renders in AccountLiabilitySection once it lands.
 */
function CompleteConnectionPrompt({ plaidItemId, noun }) {
  const { refreshAccounts } = useAccounts();
  const [linkToken, setLinkToken] = useState(null);
  // idle | preparing | exchanging | done | error
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  const openedRef = useRef(false);

  const exchange = async (publicToken) => {
    try {
      setPhase("exchanging");
      const res = await authFetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken, existingPlaidItemId: plaidItemId }),
      });
      if (!res.ok) throw new Error("Couldn't finalize the connection");
      await refreshAccounts();
      setPhase("done");
    } catch (e) {
      setError(e.message || "Something went wrong");
      setPhase("error");
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => exchange(publicToken),
    onExit: (err) => {
      openedRef.current = false;
      setLinkToken(null);
      if (err) {
        setError(err.display_message || err.error_message || "Connection cancelled");
        setPhase("error");
      } else {
        setPhase("idle");
      }
    },
  });

  useEffect(() => {
    if (linkToken && ready && phase === "preparing" && !openedRef.current) {
      openedRef.current = true;
      open();
    }
  }, [linkToken, ready, phase, open]);

  const start = async () => {
    setError(null);
    setPhase("preparing");
    openedRef.current = false;
    try {
      const res = await authFetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plaidItemId, additionalProducts: ["liabilities"] }),
      });
      if (!res.ok) throw new Error("Couldn't start the connection");
      const data = await res.json();
      setLinkToken(data.link_token);
    } catch (e) {
      setError(e.message || "Couldn't start the connection");
      setPhase("error");
    }
  };

  if (phase === "done") {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4">
        <div className="text-sm font-medium text-[var(--color-fg)]">Details are syncing</div>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          APR, statement balance, and due dates will appear here shortly.
        </p>
      </div>
    );
  }

  const busy = phase === "preparing" || phase === "exchanging";

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]/40 p-4">
      <div className="text-sm font-medium text-[var(--color-fg)]">Complete this connection</div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        Add {noun} details — APR, statement balance, and due dates.
      </p>
      {error && <p className="mt-2 text-xs text-[var(--color-danger)]">{error}</p>}
      <Button size="sm" className="mt-3" loading={busy} onClick={start}>
        {phase === "error" ? "Try again" : "Complete setup"}
      </Button>
    </div>
  );
}

export default function AccountDetails({ account, institution, onViewTransactions }) {
  if (!account) return null;

  const subtypeLabel = formatAccountSubtype(account.type);
  const isLiability = isLiabilityAccount(account);
  const isCredit = isCreditAccount(account.type);
  const currency = account.isoCurrencyCode || "USD";
  const addedOn = formatDate(account.createdAt);

  // Liability account whose Plaid item lacks the liabilities product — offer
  // to complete the connection so its card/loan metadata starts syncing.
  const needsLiabilities =
    isLiability &&
    !!account.plaidItemId &&
    !(account.products || []).includes("liabilities");

  const hasCreditVisual = isCredit && account.limit != null && account.limit > 0;
  const showAvailableRow =
    !hasCreditVisual &&
    account.available != null &&
    Math.abs((account.available ?? 0) - (account.balance ?? 0)) > 0.005;

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={account.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.25, ease: "circOut" }}
        className="flex flex-col"
      >
        {/* Header — stacked layout so long institution names + big
            balances don't fight for horizontal space on narrow
            viewports. Matches the transaction details header. No
            horizontal padding here; the Drawer's own px-5 handles it. */}
        <div className="pt-6 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              {institution?.logo ? (
                <img
                  src={institution.logo}
                  alt={institution.name || ""}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                    if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className={`w-full h-full flex items-center justify-center ${institution?.logo ? "hidden" : "flex"}`}
              >
                <PiBankFill className="w-5 h-5 text-[var(--color-muted)]" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-medium text-[var(--color-fg)] truncate">
                {account.name}
              </h2>
              <div className="text-xs text-[var(--color-muted)] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                {subtypeLabel && <span>{subtypeLabel}</span>}
                {subtypeLabel && account.mask && (
                  <span className="opacity-40 mx-1.5">&middot;</span>
                )}
                {account.mask && <span className="font-mono">&bull;&bull;&bull;&bull; {account.mask}</span>}
              </div>
            </div>
          </div>
          <div className="mt-4 text-2xl font-medium tracking-tight tabular-nums text-[var(--color-fg)]">
            {formatCurrency(account.balance, currency)}
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 pb-6">
          {/* Credit utilization visual */}
          {hasCreditVisual && (
            <div>
              <div className="card-header mb-3">Credit Used</div>
              <CreditUtilization
                balance={account.balance}
                limit={account.limit}
                available={account.available}
                currency={currency}
              />
            </div>
          )}

          {/* Meta rows */}
          {(showAvailableRow || institution?.name || addedOn) && (
            <div>
              {showAvailableRow && (
                <div className="flex items-center justify-between py-2">
                  <span className="card-header">Available</span>
                  <span className="text-sm text-[var(--color-fg)] tabular-nums">
                    {formatCurrency(account.available, currency)}
                  </span>
                </div>
              )}

              {institution?.name && (
                <div className="flex items-center justify-between py-2">
                  <span className="card-header">Institution</span>
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end pl-4">
                    {institution.logo && (
                      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                        <img
                          src={institution.logo}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    <span className="text-sm text-[var(--color-fg)] truncate text-right">
                      {institution.name}
                    </span>
                  </div>
                </div>
              )}

              {addedOn && (
                <div className="flex items-center justify-between py-2">
                  <span className="card-header">Added</span>
                  <span className="text-sm text-[var(--color-fg)]">{addedOn}</span>
                </div>
              )}
            </div>
          )}

          {/* Complete-connection prompt for liability accounts missing the
              liabilities product (e.g. linked before we supported it). */}
          {needsLiabilities && (
            <CompleteConnectionPrompt
              plaidItemId={account.plaidItemId}
              noun={isCredit ? "card" : "loan"}
            />
          )}

          {/* Liabilities-product detail — APR, statement, payment due, etc.
              Only renders for liability accounts and only if a row exists
              in the liabilities table (sync may not have run yet). */}
          {isLiability && (
            <AccountLiabilitySection
              accountId={account.id}
              currency={currency}
            />
          )}

          {/* Actions */}
          {onViewTransactions && (
            <div className="pt-2">
              <Button variant="primary" size="sm" onClick={onViewTransactions}>
                View all transactions
              </Button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
