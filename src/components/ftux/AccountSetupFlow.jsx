"use client";

import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaidLink } from "react-plaid-link";
import { FiArrowRight, FiCheckCircle, FiLoader, FiAlertCircle } from "react-icons/fi";
import Button from "../ui/Button";
import { useAccounts } from "../providers/AccountsProvider";

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
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? "h-2 w-5 bg-zinc-900"
              : "h-2 w-2 bg-zinc-300"
          }`}
        />
      ))}
    </div>
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
      <Button onClick={onNext} className="mt-10 h-11 px-8">
        Get started
        <FiArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

/* ── Step 2: Account Type ────────────────────────────────────── */
function AccountTypeStep({ onSelect }) {
  return (
    <div className="w-full max-w-sm">
      <h2 className="mb-6 text-center text-xl font-semibold tracking-tight text-zinc-900">
        What would you like to connect?
      </h2>
      <div className="flex flex-col gap-3">
        {ACCOUNT_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => onSelect(type)}
            className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-4 text-left shadow-sm transition-all hover:border-zinc-400 hover:shadow-md active:scale-[0.98]"
          >
            <div>
              <div className="text-sm font-semibold text-zinc-900">{type.label}</div>
              <div className="mt-0.5 text-xs text-zinc-500">{type.description}</div>
            </div>
            <FiArrowRight className="ml-4 h-4 w-4 flex-shrink-0 text-zinc-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Step 3: Connecting (uses Plaid) ────────────────────────── */
function ConnectingStep({ accountType, onSuccess, onError }) {
  const { addAccount, refreshAccounts } = useAccounts();
  const [linkToken, setLinkToken] = useState(null);
  const [error, setError] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  const handlePlaidSuccess = async (publicToken) => {
    try {
      setExchanging(true);
      const response = await fetch("/api/plaid/exchange-token", {
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
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: handlePlaidSuccess,
    onExit: handlePlaidExit,
  });

  // Fetch link token on mount
  useEffect(() => {
    let cancelled = false;

    async function fetchToken() {
      setFetching(true);
      setError(null);
      try {
        const response = await fetch("/api/plaid/link-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountType: accountType.id }),
        });

        if (!response.ok) throw new Error("Failed to create link token");

        const data = await response.json();
        if (!cancelled) setLinkToken(data.link_token);
      } catch (err) {
        if (!cancelled) {
          const msg = err.message || "Failed to prepare connection";
          setError(msg);
          onError(msg);
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    }

    fetchToken();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountType.id]);

  // Open Plaid when ready
  useEffect(() => {
    if (linkToken && ready && !error) {
      open();
    }
  }, [linkToken, ready, error, open]);

  if (error) {
    return (
      <div className="flex flex-col items-center text-center">
        <FiAlertCircle className="mb-4 h-10 w-10 text-red-400" />
        <p className="text-sm font-medium text-zinc-900">Something went wrong</p>
        <p className="mt-1 text-sm text-zinc-500">{error}</p>
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

/* ── Step 4: Done ───────────────────────────────────────────── */
function DoneStep({ onComplete }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
        <FiCheckCircle className="h-7 w-7 text-emerald-600" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">You&apos;re all set.</h2>
      <p className="mt-2 text-sm text-zinc-500">Your account is connected. Let&apos;s go.</p>
      <Button onClick={onComplete} className="mt-10 h-11 px-8">
        Go to dashboard
        <FiArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function AccountSetupFlow({ userName, onComplete = null }) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedAccountType, setSelectedAccountType] = useState(null);
  const [plaidData, setPlaidData] = useState(null);
  const [connectError, setConnectError] = useState(null);

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
    goTo(2);
  };

  const handlePlaidSuccess = (data) => {
    setPlaidData(data);
    goTo(3);
  };

  const handlePlaidError = (msg) => {
    setConnectError(msg);
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
          />
        );
      case 2:
        return (
          <ConnectingStep
            key={`connecting-${selectedAccountType?.id}`}
            accountType={selectedAccountType}
            onSuccess={handlePlaidSuccess}
            onError={handlePlaidError}
          />
        );
      case 3:
        return (
          <DoneStep
            key="done"
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
