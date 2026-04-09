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

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

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
    const existing = existingAccountIdsRef.current;
    const newAccounts = (data?.accounts || []).filter((a) => {
      const plaidAccountId = a.account_id;
      if (!plaidAccountId) return true;
      return !existing.has(plaidAccountId);
    });
    setPlaidData({
      ...data,
      accounts: newAccounts.length > 0 ? newAccounts : data?.accounts || [],
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
            className="fixed inset-0 z-[100] bg-[var(--color-content-bg)] overflow-y-auto"
          >
            {/* Close button (top-right of viewport) */}
            <button
              type="button"
              onClick={onClose}
              className="fixed top-5 right-5 md:top-6 md:right-6 z-10 p-2 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <FiX className="h-5 w-5" />
            </button>

            {/* Content wrapper */}
            <div className="min-h-screen flex items-center justify-center px-6 py-20">
              <div className="w-full max-w-md">
                <AnimatePresence mode="wait">
                  {step === "choose" && (
                    <motion.div
                      key="choose"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
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
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
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
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ConnectedStep plaidData={plaidData} onClose={onClose} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <UpgradeOverlay isOpen={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </>,
    document.body
  );
}

/* ── Shared primitives ────────────────────────────────────── */

function SectionLabel({ children, className = "" }) {
  return (
    <div
      className={`text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 ${className}`}
    >
      {children}
    </div>
  );
}

function InstitutionAvatar({ logo, name, size = 36 }) {
  const dim = `${size}px`;
  const fontSize = size >= 44 ? "text-base" : "text-xs";
  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: dim, height: dim }}
    >
      {logo && (
        <img
          src={logo}
          alt={name || ""}
          className="absolute inset-0 rounded-full object-contain bg-zinc-900 border border-white/10"
          style={{ width: dim, height: dim }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}
      <div
        className="rounded-full bg-white/5 border border-white/10 flex items-center justify-center"
        style={{ width: dim, height: dim }}
      >
        <span className={`font-semibold text-zinc-400 ${fontSize}`}>
          {(name || "?").charAt(0).toUpperCase()}
        </span>
      </div>
    </div>
  );
}

/* ── Step: Choose institution ─────────────────────────────── */

function ChooseStep({ institutions, onSelectExisting, onSelectNew }) {
  return (
    <div>
      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="text-[28px] font-semibold tracking-tight text-white"
      >
        Add an account
      </motion.h1>

      <div className="mt-10 space-y-10">
        {institutions.length > 0 && (
          <div>
            <SectionLabel className="mb-2">Your connections</SectionLabel>
            <div className="divide-y divide-white/[0.06]">
              {institutions.map((inst, i) => (
                <InstitutionRow
                  key={inst.id}
                  index={i}
                  onClick={() => onSelectExisting(inst)}
                  avatar={<InstitutionAvatar logo={inst.logo} name={inst.name} />}
                  title={inst.name}
                  subtitle="Add more accounts"
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionLabel className="mb-2">New connection</SectionLabel>
          <div>
            <InstitutionRow
              index={institutions.length}
              onClick={onSelectNew}
              avatar={
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10 flex-shrink-0">
                  <FiPlus className="h-4 w-4 text-zinc-400" />
                </div>
              }
              title="Link an institution"
              subtitle="Connect a new bank or brokerage"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InstitutionRow({ index, onClick, avatar, title, subtitle }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.04 }}
      whileHover={{ x: 2 }}
      className="group flex w-full items-center gap-4 py-4 text-left cursor-pointer"
    >
      {avatar}
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-medium text-white truncate">{title}</div>
        <div className="text-xs text-zinc-500 mt-0.5">{subtitle}</div>
      </div>
      <FiChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-300 transition-colors flex-shrink-0" />
    </motion.button>
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
      <div>
        <FiAlertCircle className="mb-5 h-9 w-9 text-[var(--color-danger)]" />
        <h1 className="text-[28px] font-semibold tracking-tight text-white">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-zinc-500">{error}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-8 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-300 cursor-pointer"
        >
          <FiChevronLeft className="h-4 w-4" />
          Go back
        </button>
      </div>
    );
  }

  if (plaidExited) {
    return (
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-white">
          Connection cancelled
        </h1>
        <p className="mt-2 text-sm text-zinc-500">No worries — you can try again.</p>
        <div className="mt-8 flex items-center gap-4">
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
    <div className="flex items-center gap-4">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-zinc-800 border-t-white flex-shrink-0" />
      <div>
        <div className="text-[15px] font-medium text-white">
          {exchanging ? "Finalizing connection" : "Preparing secure connection"}
        </div>
        <div className="text-xs text-zinc-500 mt-0.5">This only takes a moment.</div>
      </div>
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
    <div>
      {/* Institution logo → dots → checkmark (left-aligned) */}
      <div className="mb-8 flex items-center gap-2">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        >
          <InstitutionAvatar logo={institution?.logo} name={institution?.name} size={44} />
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
          className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 flex-shrink-0"
        >
          <FiCheck className="h-5 w-5 text-white" strokeWidth={3} />
        </motion.div>
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-[28px] font-semibold tracking-tight text-white"
      >
        {headline}
      </motion.h1>

      {accounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="mt-10"
        >
          <SectionLabel className="mb-2">
            {accounts.length === 1 ? "Account" : "Accounts"}
          </SectionLabel>
          <div className="divide-y divide-white/[0.06]">
            {accounts.map((account, i) => (
              <motion.div
                key={account.id || account.account_id || i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.85 + i * 0.05 }}
                className="flex items-center gap-4 py-4"
              >
                <InstitutionAvatar
                  logo={institution?.logo}
                  name={institution?.name || account.name}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-white truncate">
                    {account.name}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
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
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: accounts.length > 0 ? 0.9 + accounts.length * 0.05 : 0.75 }}
        className="mt-10"
      >
        <Button onClick={onClose} className="w-full h-11">
          Done
        </Button>
      </motion.div>
    </div>
  );
}
