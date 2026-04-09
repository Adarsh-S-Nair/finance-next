"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaidLink } from "react-plaid-link";
import {
  FiX,
  FiCheck,
  FiPlus,
  FiChevronLeft,
  FiChevronRight,
  FiAlertCircle,
} from "react-icons/fi";
import Button from "./ui/Button";
import MockPlaidLink from "./MockPlaidLink";
import UpgradeOverlay from "./UpgradeOverlay";
import { useAccounts } from "./providers/AccountsProvider";
import { useUser } from "./providers/UserProvider";
import { authFetch } from "../lib/api/fetch";

const isMockPlaidEnv = process.env.NEXT_PUBLIC_PLAID_ENV === "mock";

const SUBTYPE_LABELS = {
  checking: "Checking",
  savings: "Savings",
  "money market": "Money Market",
  cd: "CD",
  "credit card": "Credit Card",
  "401k": "401(k)",
  "401a": "401(a)",
  ira: "IRA",
  roth: "Roth IRA",
  "roth 401k": "Roth 401(k)",
  brokerage: "Brokerage",
  "mutual fund": "Mutual Fund",
  hsa: "HSA",
  "529": "529 Plan",
};

function formatSubtype(subtype) {
  if (!subtype) return "";
  return SUBTYPE_LABELS[subtype] || subtype.charAt(0).toUpperCase() + subtype.slice(1);
}

export default function AddAccountOverlay({ isOpen, onClose }) {
  const { accounts, allAccounts, refreshAccounts } = useAccounts();
  const { isPro } = useUser();

  const [step, setStep] = useState("choose"); // choose | connecting | connected
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [selectedInstitution, setSelectedInstitution] = useState(null);
  const [plaidData, setPlaidData] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Snapshot of existing Plaid account_ids at the moment we open Link.
  // Used to filter the exchange response down to only newly added accounts.
  const existingAccountIdsRef = useRef(new Set());

  // Reset state shortly after the overlay closes so exit animation can play.
  useEffect(() => {
    if (isOpen) return;
    const t = setTimeout(() => {
      setStep("choose");
      setSelectedItemId(null);
      setSelectedInstitution(null);
      setPlaidData(null);
      existingAccountIdsRef.current = new Set();
    }, 250);
    return () => clearTimeout(t);
  }, [isOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  const snapshotExistingAccounts = () => {
    existingAccountIdsRef.current = new Set(
      allAccounts.map((a) => a.accountId).filter(Boolean)
    );
  };

  const handleSelectExisting = (institution) => {
    snapshotExistingAccounts();
    setSelectedItemId(institution.plaidItemId);
    setSelectedInstitution(institution);
    setStep("connecting");
  };

  const handleSelectNew = () => {
    if (!isPro && accounts.length >= 1) {
      onClose();
      setShowUpgrade(true);
      return;
    }
    snapshotExistingAccounts();
    setSelectedItemId(null);
    setSelectedInstitution(null);
    setStep("connecting");
  };

  const handleBack = () => {
    setSelectedItemId(null);
    setSelectedInstitution(null);
    setStep("choose");
  };

  const handleConnectingSuccess = (data) => {
    // Filter returned accounts to only those we didn't already have — in update mode,
    // Plaid/exchange returns ALL accounts on the item, but we only want to celebrate new ones.
    const existing = existingAccountIdsRef.current;
    const newAccounts = (data?.accounts || []).filter((a) => {
      const plaidAccountId = a.account_id;
      if (!plaidAccountId) return true;
      return !existing.has(plaidAccountId);
    });
    setPlaidData({
      ...data,
      accounts: newAccounts.length > 0 ? newAccounts : data?.accounts || [],
      _onlyNew: newAccounts.length > 0,
      institution:
        data?.institution ||
        (selectedInstitution
          ? { name: selectedInstitution.name, logo: selectedInstitution.logo }
          : null),
    });
    setStep("connected");
    refreshAccounts();
  };

  const handleUpgradeNeeded = () => {
    onClose();
    setShowUpgrade(true);
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="add-account-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm px-5"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="relative w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute -top-10 right-0 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <FiX className="h-5 w-5" />
              </button>

              <div className="relative w-full overflow-hidden px-4 py-2">
                <AnimatePresence mode="wait">
                  {step === "choose" && (
                    <motion.div
                      key="choose"
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChooseStep
                        institutions={accounts}
                        onSelectExisting={handleSelectExisting}
                        onSelectNew={handleSelectNew}
                      />
                    </motion.div>
                  )}

                  {step === "connecting" && (
                    <motion.div
                      key="connecting"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -16 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ConnectingStep
                        plaidItemId={selectedItemId}
                        onSuccess={handleConnectingSuccess}
                        onBack={handleBack}
                        onUpgradeNeeded={handleUpgradeNeeded}
                      />
                    </motion.div>
                  )}

                  {step === "connected" && (
                    <motion.div
                      key="connected"
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ConnectedStep plaidData={plaidData} onClose={onClose} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <UpgradeOverlay isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>,
    document.body
  );
}

/* ── Step: Choose institution ─────────────────────────────── */

function ChooseStep({ institutions, onSelectExisting, onSelectNew }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-white">Add an account</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Add to a connection you already have, or link a new institution.
      </p>

      <div className="mt-8 w-full max-w-sm">
        {institutions.length > 0 && (
          <div className="text-left">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Your connections
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 overflow-hidden">
              {institutions.map((inst, i) => (
                <motion.button
                  key={inst.id}
                  type="button"
                  onClick={() => onSelectExisting(inst)}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="group flex w-full items-center gap-3.5 px-4 py-4 text-left transition-colors hover:bg-white/5 cursor-pointer"
                >
                  <div className="relative h-8 w-8 flex-shrink-0">
                    {inst.logo && (
                      <img
                        src={inst.logo}
                        alt={inst.name || ""}
                        className="h-8 w-8 rounded-full object-contain bg-zinc-900 border border-white/10 absolute inset-0"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    )}
                    <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="text-xs font-semibold text-zinc-400">
                        {(inst.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{inst.name}</div>
                    <div className="text-xs text-zinc-500">Add more accounts</div>
                  </div>
                  <FiChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        <motion.button
          type="button"
          onClick={onSelectNew}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: institutions.length * 0.04 + 0.05 }}
          className="mt-4 flex w-full items-center gap-3.5 rounded-xl border border-dashed border-white/10 px-4 py-4 text-left transition-colors hover:border-white/20 hover:bg-white/5 cursor-pointer group"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 border border-white/10 flex-shrink-0">
            <FiPlus className="h-4 w-4 text-zinc-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white">New institution</div>
            <div className="text-xs text-zinc-500">Connect a different bank or brokerage</div>
          </div>
          <FiChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors flex-shrink-0" />
        </motion.button>
      </div>
    </div>
  );
}

/* ── Step: Connecting (Plaid Link) ────────────────────────── */

function ConnectingStep({ plaidItemId, onSuccess, onBack, onUpgradeNeeded }) {
  const [linkToken, setLinkToken] = useState(null);
  const [activePlaidItemId, setActivePlaidItemId] = useState(plaidItemId);
  const [error, setError] = useState(null);
  const [exchanging, setExchanging] = useState(false);
  const [plaidExited, setPlaidExited] = useState(false);
  const [showMockPicker, setShowMockPicker] = useState(false);

  const exchangeToken = async (publicToken) => {
    try {
      setExchanging(true);
      setShowMockPicker(false);
      const body = { publicToken };
      if (activePlaidItemId) body.existingPlaidItemId = activePlaidItemId;
      const response = await authFetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Failed to exchange token");
      const data = await response.json();
      onSuccess(data);
    } catch (err) {
      console.error("Error exchanging token:", err);
      setError(err.message || "Connection failed");
    } finally {
      setExchanging(false);
    }
  };

  const handlePlaidExit = (err) => {
    if (err) {
      setError(
        err.display_message ||
          err.error_message ||
          err.message ||
          "An error occurred during account linking"
      );
    } else {
      setPlaidExited(true);
    }
  };

  const { open, ready } = usePlaidLink({
    token: isMockPlaidEnv ? null : linkToken,
    onSuccess: (publicToken) => exchangeToken(publicToken),
    onExit: handlePlaidExit,
  });

  useEffect(() => {
    let cancelled = false;
    async function connect() {
      setError(null);
      try {
        const body = {};
        if (plaidItemId) {
          body.plaidItemId = plaidItemId;
          body.additionalProducts = ["investments"];
        }
        const response = await authFetch("/api/plaid/link-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          if (response.status === 403 && errBody.error === "connection_limit") {
            onUpgradeNeeded?.();
            return;
          }
          throw new Error(errBody.error || "Failed to create link token");
        }
        const data = await response.json();
        if (cancelled) return;
        if (data.plaidItemId) setActivePlaidItemId(data.plaidItemId);
        if (isMockPlaidEnv) {
          setShowMockPicker(true);
        } else {
          setLinkToken(data.link_token);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to prepare connection");
      }
    }
    connect();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isMockPlaidEnv && linkToken && ready && !error && !plaidExited) {
      open();
    }
  }, [linkToken, ready, error, open, plaidExited]);

  if (isMockPlaidEnv && showMockPicker) {
    return (
      <MockPlaidLink
        onSuccess={(token) => exchangeToken(token)}
        onExit={() => {
          setShowMockPicker(false);
          setPlaidExited(true);
        }}
      />
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center text-center">
        <FiAlertCircle className="mb-4 h-10 w-10 text-[var(--color-danger)]" />
        <p className="text-sm font-medium text-white">Something went wrong</p>
        <p className="mt-1 text-sm text-zinc-500">{error}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300 cursor-pointer"
        >
          <FiChevronLeft className="h-4 w-4" />
          Go back
        </button>
      </div>
    );
  }

  if (plaidExited) {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-sm font-medium text-white">Connection cancelled</p>
        <p className="mt-1 text-sm text-zinc-500">No worries — you can try again.</p>
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300 cursor-pointer"
          >
            <FiChevronLeft className="h-4 w-4" />
            Back
          </button>
          <Button
            onClick={() => {
              setPlaidExited(false);
              if (isMockPlaidEnv) {
                setShowMockPicker(true);
              } else {
                open();
              }
            }}
            className="h-9 px-5 text-sm cursor-pointer"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-zinc-700 border-t-white" />
      <p className="text-sm font-medium text-white">
        {exchanging ? "Finalizing connection…" : "Preparing secure connection…"}
      </p>
      <p className="mt-1 text-xs text-zinc-400">This only takes a moment.</p>
    </div>
  );
}

/* ── Step: Connected ──────────────────────────────────────── */

function ConnectedStep({ plaidData, onClose }) {
  const accounts = plaidData?.accounts || [];
  const institution = plaidData?.institution;

  const headline =
    accounts.length === 0
      ? "All set"
      : accounts.length === 1
        ? "Account added"
        : `${accounts.length} accounts added`;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-6 flex items-center gap-2">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="relative h-12 w-12 flex-shrink-0"
        >
          {institution?.logo && (
            <img
              src={institution.logo}
              alt={institution.name || ""}
              className="h-12 w-12 rounded-full object-contain bg-zinc-900 border border-white/10 absolute inset-0"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          )}
          <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-base font-semibold text-zinc-400">
              {(institution?.name || "?").charAt(0).toUpperCase()}
            </span>
          </div>
        </motion.div>

        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.4 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="h-1.5 w-1.5 rounded-full bg-zinc-600"
          />
        ))}

        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.5 }}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 flex-shrink-0"
        >
          <FiCheck className="h-6 w-6 text-white" strokeWidth={3} />
        </motion.div>
      </div>

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-2xl font-semibold tracking-tight text-white"
      >
        {headline}
      </motion.h2>

      {accounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-5 w-full max-w-xs"
        >
          <div className="rounded-xl border border-white/10 bg-white/5 divide-y divide-white/5 overflow-hidden">
            {accounts.map((account, i) => (
              <motion.div
                key={account.id || account.account_id || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 + i * 0.05 }}
                className="flex items-center gap-3.5 px-4 py-4"
              >
                <div className="relative h-8 w-8 flex-shrink-0">
                  {institution?.logo && (
                    <img
                      src={institution.logo}
                      alt={institution.name || ""}
                      className="h-8 w-8 rounded-full object-contain bg-zinc-900 border border-white/10 absolute inset-0"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-zinc-400">
                      {(institution?.name || account.name || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="text-left flex-1 min-w-0 space-y-1">
                  <div className="text-sm font-medium text-white truncate">{account.name}</div>
                  <div className="text-xs text-zinc-500">
                    {formatSubtype(account.subtype)}
                    {account.mask ? ` · ••${account.mask}` : ""}
                  </div>
                </div>
                {account.balances?.current != null && (
                  <div className="text-sm tabular-nums text-zinc-400 flex-shrink-0">
                    $
                    {Number(account.balances.current).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: accounts.length > 0 ? 0.8 + accounts.length * 0.05 : 0.7 }}
        className="mt-6 w-full max-w-xs"
      >
        <Button onClick={onClose} className="w-full h-11">
          Done
        </Button>
      </motion.div>
    </div>
  );
}
