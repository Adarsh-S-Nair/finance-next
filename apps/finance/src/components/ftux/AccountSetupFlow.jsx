"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaidLink } from "react-plaid-link";
import { FiChevronRight, FiChevronLeft, FiCheck, FiAlertCircle } from "react-icons/fi";
import { useAccounts } from "../providers/AccountsProvider";
import { authFetch } from "../../lib/api/fetch";
import { capitalizeFirstOnly } from "../../lib/utils/formatName";
import { supabase } from "../../lib/supabase/client";
import { Button, GoogleSignInButton } from "@zervo/ui";

// Step layout:
//   0/1 → GoogleSignUpGate (pre-auth — user arrives unauthenticated)
//   2   → Welcome          (authenticated, about to connect)
//   3   → Connecting       (Plaid Link)
//   4   → Connected        (summary + CTA to dashboard)
//
// Steps 0 and 1 both render the gate. The redundancy is historical —
// /setup/page.jsx and the profile.onboarding_step column both use these
// step indices to resume users mid-flow. Collapsing to a single pre-auth
// step would require a data migration, so we just alias them here.
const TOTAL_STEPS = 3; // welcome + connecting + connected; gate has no dot.

const slideVariants = {
  enter: (direction) => ({
    x: direction > 0 ? "40%" : "-40%",
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction < 0 ? "20%" : "-20%",
    opacity: 0,
  }),
};

const slideTransition = {
  x: { type: "spring", stiffness: 300, damping: 30 },
  opacity: { duration: 0.1, ease: "easeIn" },
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
              ? "h-2 w-5 bg-[var(--color-fg)]"
              : "h-2 w-2 bg-[var(--color-border)]"
          }`}
        />
      ))}
    </div>
  );
}

/* ── Pre-auth: Google sign-up gate ────────────────────────────── */
function GoogleSignUpGate() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback/exchange?next=/setup`,
      },
    });
    if (error) {
      console.error("[GoogleSignUpGate] OAuth error", error);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start text-left w-full max-w-sm">
      <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Sign up with Google to get started in seconds.
      </p>
      <div className="mt-8 w-full">
        <GoogleSignInButton loading={loading} onClick={handleGoogleSignUp} label="Sign up with Google" />
      </div>
    </div>
  );
}

/* ── Step 2: Welcome ────────────────────────────────────────── */
function WelcomeStep({ firstName, onNext }) {
  return (
    <div className="flex flex-col items-start text-left w-full max-w-md">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-2xl font-medium tracking-tight text-[var(--color-fg)]"
      >
        Welcome, {firstName}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        className="mt-3 text-[15px] text-[var(--color-muted)] leading-relaxed max-w-sm"
      >
        Connect your accounts and get a complete picture of your finances in one place.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
        className="mt-10 w-full max-w-xs"
      >
        <Button fullWidth onClick={onNext} className="h-12 text-base">
          Get started
          <FiChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

/* ── Step 3: Connecting (Plaid Link) ────────────────────────── */
function ConnectingStep({ onSuccess, onError, onBack }) {
  const { addAccount, refreshAccounts } = useAccounts();
  const [linkToken, setLinkToken] = useState(null);
  const [error, setError] = useState(null);
  const [exchanging, setExchanging] = useState(false);
  const [plaidOpened, setPlaidOpened] = useState(false);

  // Prevent strict-mode double-invocation of open(), which otherwise
  // fires a phantom onExit (visible to the user as a bogus cancel).
  const openedRef = useRef(false);

  const exchangeToken = async (publicToken) => {
    try {
      setExchanging(true);
      const response = await authFetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicToken }),
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
      return;
    }
    // Clean exit → just go back to the welcome step instead of showing
    // a "Connection cancelled" intermediate state.
    onBack?.();
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => exchangeToken(publicToken),
    onExit: handlePlaidExit,
  });

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      setError(null);
      try {
        const response = await authFetch("/api/plaid/link-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (!response.ok) throw new Error("Failed to create link token");

        const data = await response.json();
        if (cancelled) return;
        setLinkToken(data.link_token);
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
  }, []);

  useEffect(() => {
    if (linkToken && ready && !error && !openedRef.current) {
      openedRef.current = true;
      setPlaidOpened(true);
      open();
    }
  }, [linkToken, ready, error, open]);

  if (error) {
    return (
      <div className="flex flex-col items-start text-left">
        <FiAlertCircle className="mb-4 h-9 w-9 text-[var(--color-danger)]" />
        <p className="text-base font-medium text-[var(--color-fg)]">Something went wrong</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{error}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-fg)] cursor-pointer"
        >
          <FiChevronLeft className="h-4 w-4" />
          Go back
        </button>
      </div>
    );
  }

  // Plaid has taken over with its own modal + spinner — render nothing behind it.
  if (plaidOpened && !exchanging) {
    return null;
  }

  // Either fetching the link token, or exchanging after success.
  return (
    <div className="flex items-center gap-4">
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--color-border)] border-t-[var(--color-fg)] flex-shrink-0" />
      <div>
        <div className="text-[15px] font-medium text-[var(--color-fg)]">
          {exchanging ? "Finalizing connection" : "Preparing secure connection"}
        </div>
        <div className="text-xs text-[var(--color-muted)] mt-0.5">This only takes a moment.</div>
      </div>
    </div>
  );
}

/* ── Step 4: Connected ──────────────────────────────────────── */

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

function ConnectedStep({ plaidData, onComplete }) {
  const accounts = plaidData?.accounts || [];
  const institution = plaidData?.institution;

  return (
    <div className="flex flex-col items-start text-left w-full max-w-md">
      {/* Institution logo → dots → green checkmark (centered within the column) */}
      <div className="mb-8 flex items-center gap-2 self-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="relative h-11 w-11 flex-shrink-0"
        >
          {institution?.logo && (
            <img
              src={institution.logo}
              alt={institution.name || ""}
              className="h-11 w-11 rounded-full object-contain bg-[var(--color-surface-alt)] border border-[var(--color-border)] absolute inset-0"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
          <div className="h-11 w-11 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center">
            <span className="text-base font-semibold text-[var(--color-muted)]">
              {(institution?.name || "?").charAt(0).toUpperCase()}
            </span>
          </div>
        </motion.div>

        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            transition={{ delay: 0.2 + i * 0.08 }}
            className="h-1.5 w-1.5 rounded-full bg-[var(--color-muted)]"
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

      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-2xl font-medium tracking-tight text-[var(--color-fg)]"
      >
        {institution?.name ? `${institution.name} connected` : "Account connected"}
      </motion.h2>

      {accounts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="mt-8 w-full"
        >
          <div className="divide-y divide-[var(--color-border)]">
            {accounts.map((account, i) => (
              <motion.div
                key={account.id || account.account_id || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 + i * 0.05 }}
                className="flex items-center gap-4 py-4"
              >
                <div className="relative h-9 w-9 flex-shrink-0">
                  {institution?.logo && (
                    <img
                      src={institution.logo}
                      alt={institution.name || ""}
                      className="h-9 w-9 rounded-full object-contain bg-[var(--color-surface-alt)] border border-[var(--color-border)] absolute inset-0"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                  <div className="h-9 w-9 rounded-full bg-[var(--color-surface-alt)] border border-[var(--color-border)] flex items-center justify-center">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                      {(institution?.name || account.name || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-[15px] font-medium text-[var(--color-fg)] truncate">{account.name}</div>
                  <div className="text-xs text-[var(--color-muted)] mt-0.5">
                    {formatSubtype(account.subtype)}
                    {account.mask ? ` · ••${account.mask}` : ""}
                  </div>
                </div>
                {account.balances?.current != null && (
                  <div className="text-sm tabular-nums text-[var(--color-muted)] flex-shrink-0">
                    ${Number(account.balances.current).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        className="mt-10 w-full max-w-xs"
      >
        <Button onClick={onComplete} className="w-full h-11">
          Continue to dashboard
          <FiChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
/**
 * AccountSetupFlow
 *
 * Props:
 *   initialStep   - which step to start on (0/1=gate, 2=welcome, 3=connecting, 4=connected)
 *   userName      - pre-resolved first name (used when resuming from step 2+)
 *   onComplete    - called when the user finishes the flow
 *   onFlowStart   - called when Plaid link is about to open
 */
export default function AccountSetupFlow({ initialStep = 0, userName, onComplete = null, onFlowStart = null }) {
  const [step, setStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [plaidData, setPlaidData] = useState(null);

  const firstName = userName
    ? capitalizeFirstOnly(String(userName).split(" ")[0])
    : "there";

  const goTo = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleWelcomeNext = () => {
    onFlowStart?.();
    goTo(3);
  };

  const handlePlaidSuccess = (data) => {
    setPlaidData(data);
    goTo(4);
  };

  const handlePlaidError = () => {
    // Error is displayed within ConnectingStep
  };

  const handleComplete = () => {
    onComplete?.(plaidData);
  };

  const stepContent = () => {
    // Steps 0 and 1 both render the pre-auth Google gate. See note at the
    // top of this file for why two step indices alias to the same screen.
    if (step <= 1) {
      return <GoogleSignUpGate key="google-signup" />;
    }

    switch (step) {
      case 2:
        return (
          <WelcomeStep
            key="welcome"
            firstName={firstName}
            onNext={handleWelcomeNext}
          />
        );
      case 3:
        return (
          <ConnectingStep
            key="connecting"
            onSuccess={handlePlaidSuccess}
            onError={handlePlaidError}
            onBack={() => goTo(2)}
          />
        );
      case 4:
        return (
          <ConnectedStep
            key="connected"
            plaidData={plaidData}
            onComplete={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  // Map step 2 → dot 0, step 3 → dot 1, step 4 → dot 2. Gate (0/1) has no dot.
  const showDots = step >= 2;
  const dotCurrent = step - 2;

  return (
    <div className="flex w-full max-w-lg flex-col items-center px-5 sm:px-6">
      {/* Step content with slide animation */}
      <div className="relative w-full overflow-hidden px-4 py-2">
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

      {/* Pagination dots — hidden on the pre-auth gate. */}
      {showDots && (
        <div className="mt-12">
          <PaginationDots current={dotCurrent} total={TOTAL_STEPS} />
        </div>
      )}
    </div>
  );
}
