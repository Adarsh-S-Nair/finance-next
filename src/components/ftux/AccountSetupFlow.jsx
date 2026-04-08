"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaidLink } from "react-plaid-link";
import Link from "next/link";
import { FiChevronRight, FiChevronLeft, FiCheck, FiAlertCircle, FiEye, FiEyeOff } from "react-icons/fi";
import Button from "../ui/Button";
import MockPlaidLink from "../MockPlaidLink";
import { useAccounts } from "../providers/AccountsProvider";
import { authFetch } from "../../lib/api/fetch";
import { capitalizeFirstOnly } from "../../lib/utils/formatName";
import { upsertUserProfile } from "../../lib/user/profile";
import { supabase } from "../../lib/supabase/client";
import { GoogleSignInButton } from "../auth/LoginForm";

// Steps: 0=Name, 1=Email+Password, 2=Welcome, 3=Connecting, 4=Connected
// In production (non-mock): steps 0+1 are replaced by Google OAuth gate; steps 2=Welcome, 3=Connecting, 4=Connected
const isMockEnv = process.env.NEXT_PUBLIC_PLAID_ENV === "mock";
const TOTAL_STEPS = isMockEnv ? 5 : 3;

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
              ? "h-2 w-5 bg-white"
              : "h-2 w-2 bg-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

// Plain back arrow — no circle background
function BackButton({ onClick }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ x: -2 }}
      whileTap={{ scale: 0.9 }}
      className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors duration-150 cursor-pointer"
    >
      <FiChevronLeft className="h-5 w-5" />
    </motion.button>
  );
}

// Input class: font-medium for typed text, no focus ring/outline
const inputClassName =
  "flex h-11 w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white placeholder:text-zinc-500 placeholder:font-normal transition-all outline-none focus:outline-none focus:ring-0 focus:border-white/20 focus:bg-white/8 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Step 0: Name Collection (no auth yet) ───────────────────── */
function NameStep({ onNext, onBack }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const inputRef = useRef(null);

  const canSubmit = firstName.trim().length > 0;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) return;

    const normalizedFirst = capitalizeFirstOnly(trimmedFirst);
    const normalizedLast = capitalizeFirstOnly(lastName.trim());
    onNext({ firstName: normalizedFirst, lastName: normalizedLast || null });
  };

  return (
    <div className="flex flex-col items-center text-center w-full max-w-sm">
      <h1 className="text-xl font-semibold tracking-tight text-white">
        What&apos;s your name?
      </h1>
      <p className="mt-2 text-sm text-zinc-400">We&apos;ll use this to personalize your experience.</p>

      <form onSubmit={handleSubmit} className="mt-8 w-full text-left">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">First name</label>
          <input
            ref={inputRef}
            className={inputClassName}
            type="text"
            placeholder="Jane"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>

        <div className="mt-5 space-y-2">
          <label className="text-sm font-medium text-zinc-300">
            Last name <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            className={inputClassName}
            type="text"
            placeholder="Doe"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <AnimatePresence>
          {canSubmit && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-6"
            >
              <Button type="submit" fullWidth disabled={!canSubmit} className="h-11">
                Continue
                <FiChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}

/* ── Step 1: Email + Password (account creation) ─────────────── */
function EmailPasswordStep({ onNext, onBack, pendingName }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const emailRef = useRef(null);

  const emailValid = EMAIL_REGEX.test(email.trim());
  const canSubmit = emailValid && password.trim().length >= 1 && !loading;

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

      if (signUpError) {
        const msg = signUpError.message || "";
        if (
          msg.toLowerCase().includes("already registered") ||
          msg.toLowerCase().includes("user already exists") ||
          msg.toLowerCase().includes("email address has already been registered")
        ) {
          setError("duplicate");
        } else {
          setError(msg || "Something went wrong. Please try again.");
        }
        setLoading(false);
        return;
      }

      // Supabase may return a user with empty identities if email already exists
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setError("duplicate");
        setLoading(false);
        return;
      }

      if (data?.user) {
        try {
          const { buildAvatarUrl } = await import("../../lib/user/profile");
          const avatarUrl = buildAvatarUrl(data.user.id, data.user.email);

          if (pendingName?.firstName) {
            await supabase.auth.updateUser({
              data: {
                first_name: pendingName.firstName,
                last_name: pendingName.lastName || null,
              },
            });
          }

          await upsertUserProfile({
            avatar_url: avatarUrl,
            first_name: pendingName?.firstName || null,
            last_name: pendingName?.lastName || null,
            onboarding_step: 2,
          });
        } catch {}
        onNext(email);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center w-full max-w-sm">
      {/* Back button — plain, left-aligned above heading */}
      <div className="mb-4 self-start">
        <BackButton onClick={onBack} />
      </div>
      <h1 className="text-xl font-semibold tracking-tight text-white">
        What&apos;s your email?
      </h1>

      <form onSubmit={handleSubmit} className="mt-8 w-full text-left" noValidate>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-300">Email</label>
          <input
            ref={emailRef}
            className={inputClassName}
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            required
          />
        </div>

        <div className="mt-5 space-y-2">
          <label className="text-sm font-medium text-zinc-300">Password</label>
          <div className="relative">
            <input
              className={inputClassName}
              type={showPassword ? "text" : "password"}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null); }}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="mt-4 rounded-lg bg-white/5 px-4 py-3 text-[13px] text-zinc-400"
            >
              {error === "duplicate" ? (
                <>
                  This email is already registered.{" "}
                  <Link href="/auth" className="font-medium text-white underline underline-offset-4 hover:text-zinc-300">
                    Sign in instead
                  </Link>
                </>
              ) : (
                error
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {canSubmit && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-6"
            >
              <Button type="submit" fullWidth disabled={!canSubmit} className="h-11">
                {loading ? "Continuing…" : (
                  <>
                    Continue
                    <FiChevronRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}

/* ── Step 2: Welcome ────────────────────────────────────────── */
function WelcomeStep({ firstName, onNext }) {
  return (
    <div className="flex flex-col items-center text-center w-full max-w-md">
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-2xl font-normal tracking-tight text-white"
      >
        Welcome, {firstName}
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        className="mt-4 text-base text-zinc-400 leading-relaxed max-w-xs"
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

/* ── Step 3: Connecting (uses Plaid) ────────────────────────── */
const isMockPlaid = isMockEnv;

function ConnectingStep({ onSuccess, onError, onBack }) {
  const { addAccount, refreshAccounts } = useAccounts();
  const [linkToken, setLinkToken] = useState(null);
  const [error, setError] = useState(null);
  const [exchanging, setExchanging] = useState(false);
  const [plaidExited, setPlaidExited] = useState(false);
  const [showMockPicker, setShowMockPicker] = useState(false);

  const exchangeToken = async (publicToken) => {
    try {
      setExchanging(true);
      setShowMockPicker(false);
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
    } else {
      setPlaidExited(true);
    }
  };

  const handleMockExit = () => {
    setShowMockPicker(false);
    setPlaidExited(true);
  };

  const { open, ready } = usePlaidLink({
    token: isMockPlaid ? null : linkToken,
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

        if (isMockPlaid) {
          // Show institution picker instead of auto-connecting
          setShowMockPicker(true);
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
  }, []);

  useEffect(() => {
    if (!isMockPlaid && linkToken && ready && !error && !plaidExited) {
      open();
    }
  }, [linkToken, ready, error, open, plaidExited]);

  // Mock institution picker modal
  if (isMockPlaid && showMockPicker) {
    return (
      <MockPlaidLink
        onSuccess={(token) => exchangeToken(token)}
        onExit={handleMockExit}
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
              if (isMockPlaid) {
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
    <div className="flex flex-col items-center text-center">
      {/* Institution logo → dots → green checkmark */}
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
              onError={(e) => { e.currentTarget.style.display = "none"; }}
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
        {institution?.name ? `${institution.name} connected` : "Account connected"}
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
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-zinc-400">
                      {(institution?.name || account.name || "?").charAt(0).toUpperCase()}
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
        className="mt-6 flex flex-col items-center gap-3 w-full max-w-xs"
      >
        <Button onClick={onComplete} className="w-full h-11">
          Continue to dashboard
          <FiChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
      </motion.div>
    </div>
  );
}

/* ── Production: Google sign-up gate (pre-auth) ─────────────── */
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
    <div className="flex flex-col items-center text-center w-full max-w-sm">
      <h1 className="text-xl font-semibold tracking-tight text-white">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-zinc-400">
        Sign up with Google to get started in seconds.
      </p>
      <div className="mt-8 w-full">
        <GoogleSignInButton loading={loading} onClick={handleGoogleSignUp} label="Sign up with Google" />
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
/**
 * AccountSetupFlow
 *
 * Props:
 *   initialStep   - which step to start on (0=name, 1=email/pw, 2=connecting, 3=connected)
 *   userName      - pre-resolved first name (used when resuming from step 2+)
 *   onComplete    - called when the user finishes the flow
 *   onFlowStart   - called when Plaid link is about to open
 *
 * Production mode (NEXT_PUBLIC_PLAID_ENV !== 'mock'):
 *   - Steps 0 & 1 replaced with Google OAuth gate
 *   - Authenticated users land directly at step 2 (Plaid connection)
 *   - Pagination shows 2 dots: connect + connected
 */
export default function AccountSetupFlow({ initialStep = 0, userName, onComplete = null, onFlowStart = null }) {
  const [step, setStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [plaidData, setPlaidData] = useState(null);
  const [pendingName, setPendingName] = useState(null);
  const [resolvedFirstName, setResolvedFirstName] = useState(() => {
    if (!userName) return null;
    return capitalizeFirstOnly(String(userName).split(" ")[0]);
  });

  const firstName = resolvedFirstName || "there";

  const goTo = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleNameNext = ({ firstName: fn, lastName: ln }) => {
    setPendingName({ firstName: fn, lastName: ln });
    setResolvedFirstName(fn);
    goTo(1);
  };

  const handleEmailPasswordNext = (email) => {
    goTo(2);
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
    // Production mode: steps 0 and 1 replaced by Google OAuth gate
    if (!isMockEnv && step <= 1) {
      return <GoogleSignUpGate key="google-signup" />;
    }

    switch (step) {
      case 0:
        return (
          <NameStep
            key="name"
            onNext={handleNameNext}
          />
        );
      case 1:
        return (
          <EmailPasswordStep
            key="email-password"
            onNext={handleEmailPasswordNext}
            onBack={() => goTo(0)}
            pendingName={pendingName}
          />
        );
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

  // In production: map step 2→dot 0, step 3→dot 1, step 4→dot 2 (no dots for Google gate)
  const showDots = isMockEnv ? true : step >= 2;
  const dotCurrent = isMockEnv ? step : step - 2;

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

      {/* Pagination dots — hidden for Google gate in production */}
      {showDots && (
        <div className="mt-12">
          <PaginationDots current={dotCurrent} total={TOTAL_STEPS} />
        </div>
      )}

      {/* "Already have an account?" — fixed bottom-right, visible on pre-auth steps */}
      <AnimatePresence>
        {step <= 1 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 text-sm text-zinc-500"
          >
            Already have an account?{" "}
            <Link href="/auth" className="font-medium text-zinc-400 underline underline-offset-4 hover:text-zinc-300">
              Sign in
            </Link>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
