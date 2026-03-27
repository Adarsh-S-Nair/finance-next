"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaidLink } from "react-plaid-link";
import { FiChevronRight, FiChevronLeft, FiCheck, FiLoader, FiAlertCircle } from "react-icons/fi";
import Button from "../ui/Button";
import { useAccounts } from "../providers/AccountsProvider";
import { authFetch } from "../../lib/api/fetch";
import { capitalizeFirstOnly } from "../../lib/utils/formatName";

const ACCOUNT_TYPES = [
  {
    id: "checking_savings",
    label: "Checking & savings",
    description: "Bank accounts and cash flow",
  },
  {
    id: "credit_card",
    label: "Credit cards",
    description: "Card balances and spending",
  },
  {
    id: "investment",
    label: "Investments",
    description: "Brokerage, IRA, and 401(k)",
  },
];

const TOTAL_STEPS = 4;

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? "60%" : "-60%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction < 0 ? "60%" : "-60%",
    opacity: 0,
  }),
};

const slideTransition = {
  x: { type: "spring", stiffness: 300, damping: 30 },
  opacity: { duration: 0.2 },
};

function PaginationDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          layout
          className={`rounded-full transition-colors duration-300 ${
            i === current
              ? "h-2 w-5 bg-zinc-900"
              : "h-2 w-2 bg-zinc-300"
          }`}
        />
      ))}
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="h-9 w-9 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-700 transition-colors duration-150 cursor-pointer"
    >
      <FiChevronLeft className="h-4 w-4" />
    </motion.button>
  );
}

/* ── Step 1: Welcome ─────────────────────────────────────────── */
function WelcomeStep({ firstName, onNext }) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        Hey {firstName},<br />let&apos;s get started.
      </h1>
      <p className="mt-4 text-base text-zinc-500">Connect your first account to get going.</p>
      <Button onClick={onNext} className="mt-10 h-11 px-8 cursor-pointer">
        Get started
        <FiChevronRight className="ml-1.5 h-4 w-4" />
      </Button>
    </div>
  );
}

/* ── Step 2: Account Type ────────────────────────────────────── */
function AccountTypeStep({ onSelect, onBack }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="w-full max-w-sm">
      <div className="mb-5">
        <BackButton onClick={onBack} />
      </div>
      <h2 className="mb-5 text-center text-xl font-semibold tracking-tight text-zinc-900">
        What would you like to connect?
      </h2>
      <div className="flex flex-col divide-y divide-zinc-100">
        {ACCOUNT_TYPES.map((type) => {
          const isSelected = selected?.id === type.id;
          return (
            <motion.button
              key={type.id}
              type="button"
              onClick={() => setSelected(type)}
              whileHover={{ backgroundColor: "rgba(0,0,0,0.02)" }}
              whileTap={{ scale: 0.99 }}
              className={`flex w-full items-center justify-between py-4 px-3 text-left cursor-pointer transition-colors duration-150 ${
                isSelected ? "bg-zinc-50" : ""
              }`}
            >
              <div>
                <div className="text-sm font-medium text-zinc-900">{type.label}</div>
                <div className="mt-0.5 text-xs text-zinc-400">{type.description}</div>
              </div>
              <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-200 ${
                isSelected
                  ? "border-zinc-900 bg-zinc-900"
                  : "border-zinc-300"
              }`}>
                {isSelected && <FiCheck className="h-3 w-3 text-white" />}
              </div>
            </motion.button>
          );
        })}
      </div>
      <div className="mt-6">
        <Button
          onClick={() => onSelect(selected)}
          disabled={!selected}
          className="w-full h-11"
        >
          Continue
          <FiChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ── Step 3: Connecting (uses Plaid) ────────────────────────── */
const isMockPlaid = process.env.NEXT_PUBLIC_PLAID_ENV === "mock";

function ConnectingStep({ accountType, onSuccess, onError, onBack }) {
  const { addAccount, refreshAccounts } = useAccounts();
  const [linkToken, setLinkToken] = useState(null);
  const [error, setError] = useState(null);
  const [exchanging, setExchanging] = useState(false);
  const [plaidExited, setPlaidExited] = useState(false);

  const exchangeToken = async (publicToken) => {
    try {
      setExchanging(true);
      const response = await authFetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken, accountType: accountType.id }),
      });

      if (!response.ok) throw new Error("Failed to exchange token");

      const data = await response.json();
      if (data.accounts) {
        data.accounts.forEach((account) => addAccount(account));
      }
      await refreshAccounts();
      onSuccess(data);
    } catch (err) {
      console.error("Error exchanging token:", err);
      const msg = err.message || "Connection failed";
      setError(msg);
      onError(msg);
    } finally {
      setExchanging(false);
    }
  };

  const handlePlaidExit = (err) => {
    if (err) {
      const msg = err.message || "An error occurred during account linking";
      setError(msg);
      onError(msg);
    } else {
      // User closed Plaid without error — allow going back
      setPlaidExited(true);
    }
  };

  const { open, ready } = usePlaidLink({
    token: isMockPlaid ? null : linkToken,
    onSuccess: (publicToken) => exchangeToken(publicToken),
    onExit: handlePlaidExit,
  });

  // Fetch link token and connect
  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setError(null);
      try {
        const response = await authFetch("/api/plaid/link-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountType: accountType.id }),
        });

        if (!response.ok) throw new Error("Failed to create link token");

        const data = await response.json();
        if (cancelled) return;

        if (isMockPlaid) {
          // In mock mode, skip Plaid Link entirely — exchange the mock token directly
          await exchangeToken(`mock-public-${accountType.id}`);
        } else {
          setLinkToken(data.link_token);
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err.message || "Failed to prepare connection";
          setError(msg);
          onError(msg);
        }
      }
    }

    connect();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType.id]);

  // Open Plaid when ready (non-mock only)
  useEffect(() => {
    if (!isMockPlaid && linkToken && ready && !error && !plaidExited) {
      open();
    }
  }, [linkToken, ready, error, open, plaidExited]);

  if (error) {
    return (
      <div className="flex flex-col items-center text-center">
        <FiAlertCircle className="mb-4 h-10 w-10 text-[var(--color-danger)]" />
        <p className="text-sm font-medium text-zinc-900">Something went wrong</p>
        <p className="mt-1 text-sm text-zinc-500">{error}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 cursor-pointer"
        >
          <FiChevronLeft className="h-4 w-4" />
          Try a different account
        </button>
      </div>
    );
  }

  if (plaidExited) {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="text-sm font-medium text-zinc-900">Connection cancelled</p>
        <p className="mt-1 text-sm text-zinc-500">No worries — you can try again.</p>
        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 cursor-pointer"
          >
            <FiChevronLeft className="h-4 w-4" />
            Back
          </button>
          <Button onClick={() => { setPlaidExited(false); open(); }} className="h-9 px-5 text-sm cursor-pointer">
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center">
      <FiLoader className="mb-4 h-10 w-10 animate-spin text-zinc-400" />
      <p className="text-sm font-medium text-zinc-900">
        {exchanging ? "Finalizing connection…" : "Preparing secure connection…"}
      </p>
      <p className="mt-1 text-xs text-zinc-400">This only takes a moment.</p>
    </div>
  );
}

/* ── Step 4: Connected + Add More ───────────────────────────── */

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

function ConnectedStep({ plaidData, onAddMore, onComplete }) {
  const accounts = plaidData?.accounts || [];
  const institution = plaidData?.institution;

  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100"
      >
        <FiCheck className="h-7 w-7 text-zinc-700" />
      </motion.div>
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-semibold tracking-tight text-zinc-900"
      >
        {institution?.name ? `${institution.name} connected` : "Account connected"}
      </motion.h2>

      {/* Connected accounts list */}
      {accounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-5 w-full max-w-xs"
        >
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 divide-y divide-zinc-100">
            {accounts.map((account, i) => (
              <motion.div
                key={account.id || account.account_id || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.05 }}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="text-left">
                  <div className="text-sm font-medium text-zinc-900">{account.name}</div>
                  <div className="text-xs text-zinc-400">
                    {formatSubtype(account.subtype)}
                    {account.mask ? ` · ••${account.mask}` : ""}
                  </div>
                </div>
                {account.balances?.current != null && (
                  <div className="text-sm tabular-nums text-zinc-500">
                    ${Number(account.balances.current).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: accounts.length > 0 ? 0.4 + accounts.length * 0.05 : 0.3 }}
        className="mt-4 text-sm text-zinc-400"
      >
        You can always add more from settings.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: accounts.length > 0 ? 0.5 + accounts.length * 0.05 : 0.4 }}
        className="mt-6 flex flex-col items-center gap-3 w-full max-w-xs"
      >
        <Button onClick={onComplete} className="w-full h-11">
          Continue to dashboard
          <FiChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={onAddMore}
          className="text-sm text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer"
        >
          Connect another account
        </button>
      </motion.div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function AccountSetupFlow({ userName, onComplete = null, onFlowStart = null }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedAccountType, setSelectedAccountType] = useState(null);
  const [plaidData, setPlaidData] = useState(null);

  const firstName = useMemo(() => {
    if (!userName) return "there";
    return capitalizeFirstOnly(String(userName).split(" ")[0]);
  }, [userName]);

  const goTo = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleAccountTypeSelect = (type) => {
    setSelectedAccountType(type);
    // Signal to the parent (SetupPage) that the FTUX flow is now active.
    // This prevents the redirect guard from firing when AccountsProvider
    // refreshes after a successful account connection.
    onFlowStart?.();
    goTo(2);
  };

  const handlePlaidSuccess = (data) => {
    setPlaidData(data);
    goTo(3);
  };

  const handlePlaidError = () => {
    // Error is displayed within ConnectingStep
  };

  const handleAddMore = () => {
    setSelectedAccountType(null);
    goTo(1);
  };

  const handleComplete = () => {
    onComplete?.(plaidData);
  };

  const stepContent = () => {
    switch (step) {
      case 0:
        return (
          <WelcomeStep
            key="welcome"
            firstName={firstName}
            onNext={() => goTo(1)}
          />
        );
      case 1:
        return (
          <AccountTypeStep
            key="account-type"
            onSelect={handleAccountTypeSelect}
            onBack={() => goTo(0)}
          />
        );
      case 2:
        return (
          <ConnectingStep
            key={`connecting-${selectedAccountType?.id}`}
            accountType={selectedAccountType}
            onSuccess={handlePlaidSuccess}
            onError={handlePlaidError}
            onBack={() => goTo(1)}
          />
        );
      case 3:
        return (
          <ConnectedStep
            key="connected"
            plaidData={plaidData}
            onAddMore={handleAddMore}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex w-full max-w-lg flex-col items-center px-5 sm:px-6">
      {/* Step content with slide animation */}
      <div className="relative w-full overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={slideTransition}
            className="flex w-full justify-center"
          >
            {stepContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Pagination dots */}
      <div className="mt-12">
        <PaginationDots current={step} total={TOTAL_STEPS} />
      </div>
    </div>
  );
}
