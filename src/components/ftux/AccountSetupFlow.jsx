"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaidLink } from "react-plaid-link";
import { FiChevronRight, FiChevronLeft, FiCheckCircle, FiCheck, FiLoader, FiAlertCircle } from "react-icons/fi";
import Button from "../ui/Button";
import { useAccounts } from "../providers/AccountsProvider";
import { authFetch } from "../../lib/api/fetch";

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
        <FiAlertCircle className="mb-4 h-10 w-10 text-red-400" />
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
function ConnectedStep({ onAddMore, onComplete }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <FiCheckCircle className="h-7 w-7 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Account connected!</h2>
      <p className="mt-2 text-sm text-zinc-500">Want to connect another account?</p>
      <div className="mt-8 flex flex-col items-center gap-3 w-full max-w-xs">
        <Button onClick={onAddMore} className="w-full h-11 cursor-pointer">
          Connect another account
        </Button>
        <button
          type="button"
          onClick={onComplete}
          className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline transition-colors cursor-pointer"
        >
          Continue to dashboard
          <FiChevronRight className="inline ml-1 h-3.5 w-3.5" />
        </button>
      </div>
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
    return String(userName).split(" ")[0];
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
