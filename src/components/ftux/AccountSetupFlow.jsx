"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlaidLink } from "react-plaid-link";
import Link from "next/link";
import { FiChevronRight, FiChevronLeft, FiCheck, FiAlertCircle, FiPlus, FiEye, FiEyeOff } from "react-icons/fi";
import Button from "../ui/Button";
import { useAccounts } from "../providers/AccountsProvider";
import { authFetch } from "../../lib/api/fetch";
import { capitalizeFirstOnly } from "../../lib/utils/formatName";
import { upsertUserProfile } from "../../lib/user/profile";
import { supabase } from "../../lib/supabase/client";

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

// Steps: 0=Email+Password, 1=Name, 2=AccountType, 3=Connecting, 4=Connected
const TOTAL_STEPS = 5;

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

const inputClassName =
  "flex h-11 w-full rounded-lg border-0 bg-zinc-100 px-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 transition-all outline-none focus:bg-zinc-100/80 focus:ring-2 focus:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-50";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── Step 0: Email + Password (account creation) ─────────────── */
function EmailPasswordStep({ onNext }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const emailValid = EMAIL_REGEX.test(email.trim());
  const showPasswordField = emailValid;
  const canSubmit = emailValid && password.trim().length >= 1 && !loading;

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Focus password field when it becomes visible
  useEffect(() => {
    if (showPasswordField) {
      const timer = setTimeout(() => passwordRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [showPasswordField]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

      if (signUpError) {
        // Supabase returns a generic error for duplicate emails in some configs
        // but may also return user with identities=[] if email confirmation is off
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
      // (happens when email confirmation is disabled)
      if (data?.user && (!data.user.identities || data.user.identities.length === 0)) {
        setError("duplicate");
        setLoading(false);
        return;
      }

      if (data?.user) {
        // Create initial profile with onboarding_step=1 (just completed step 0)
        try {
          const { buildAvatarUrl } = await import("../../lib/user/profile");
          const avatarUrl = buildAvatarUrl(data.user.id, data.user.email);
          await upsertUserProfile({ avatar_url: avatarUrl, onboarding_step: 1 });
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
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        Create your account
      </h1>
      <p className="mt-3 text-base text-zinc-500">Get started with a free Zentari account.</p>

      <form onSubmit={handleSubmit} className="mt-8 w-full text-left" noValidate>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-800">What&apos;s your email?</label>
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

        <AnimatePresence>
          {showPasswordField && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="mt-3 space-y-1.5"
            >
              <label className="text-sm font-medium text-zinc-800">Choose a password</label>
              <div className="relative">
                <input
                  ref={passwordRef}
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-3 rounded-md bg-red-50 border border-red-100 px-3 py-2.5 text-sm text-red-700">
            {error === "duplicate" ? (
              <>
                This email is already registered.{" "}
                <Link href="/auth" className="font-medium underline underline-offset-4 hover:text-red-900">
                  Sign in instead →
                </Link>
              </>
            ) : (
              error
            )}
          </div>
        )}

        <AnimatePresence>
          {canSubmit && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="mt-4"
            >
              <Button type="submit" fullWidth disabled={!canSubmit} className="h-11">
                {loading ? "Creating account…" : (
                  <>
                    Create account
                    <FiChevronRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      <p className="mt-5 text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/auth" className="font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-700">
          Sign in →
        </Link>
      </p>
    </div>
  );
}

/* ── Step 1: Name Collection ─────────────────────────────────── */
function NameStep({ onNext, onBack }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);
  const lastNameRef = useRef(null);

  const showLastName = firstName.trim().length > 0;
  const canSubmit = firstName.trim().length > 0 && !saving;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Focus last name when it appears
  useEffect(() => {
    if (showLastName) {
      const timer = setTimeout(() => lastNameRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [showLastName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) return;

    setSaving(true);
    try {
      const normalizedFirst = capitalizeFirstOnly(trimmedFirst);
      const normalizedLast = capitalizeFirstOnly(lastName.trim());

      // Save to auth metadata and user_profiles
      await supabase.auth.updateUser({
        data: {
          first_name: normalizedFirst,
          last_name: normalizedLast || null,
        },
      });

      await upsertUserProfile({
        first_name: normalizedFirst,
        last_name: normalizedLast || null,
        onboarding_step: 2,
      });

      onNext(normalizedFirst);
    } catch (err) {
      console.error("[NameStep] save error", err);
      // Still proceed — name can be set later
      onNext(capitalizeFirstOnly(firstName.trim()));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center w-full max-w-sm">
      {onBack && (
        <div className="mb-5 self-start">
          <BackButton onClick={onBack} />
        </div>
      )}
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
        What&apos;s your first name?
      </h1>
      <p className="mt-3 text-base text-zinc-500">We&apos;ll use this to personalize your experience.</p>

      <form onSubmit={handleSubmit} className="mt-8 w-full text-left">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-800">First name</label>
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

        <AnimatePresence>
          {showLastName && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="mt-3 space-y-1.5"
            >
              <label className="text-sm font-medium text-zinc-800">
                Last name <span className="font-normal text-zinc-400">(optional)</span>
              </label>
              <input
                ref={lastNameRef}
                className={inputClassName}
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
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
              className="mt-4"
            >
              <Button type="submit" fullWidth disabled={!canSubmit} className="h-11">
                {saving ? "Saving…" : (
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

/* ── Step 2: Account Type ────────────────────────────────────── */
function AccountTypeStep({ onSelect, onBack }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = async (type) => {
    // Save progress before Plaid opens
    try {
      await upsertUserProfile({ onboarding_step: 3 });
    } catch {}
    onSelect(type);
  };

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
          onClick={() => selected && handleSelect(selected)}
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
      setPlaidExited(true);
    }
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
          body: JSON.stringify({ accountType: accountType.id }),
        });

        if (!response.ok) throw new Error("Failed to create link token");

        const data = await response.json();
        if (cancelled) return;

        if (isMockPlaid) {
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
      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-zinc-200 border-t-zinc-900" />
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
              className="h-12 w-12 rounded-full object-contain bg-white border border-zinc-100 absolute inset-0"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          )}
          <div className="h-12 w-12 rounded-full bg-zinc-100 flex items-center justify-center">
            <span className="text-base font-semibold text-zinc-500">
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
            className="h-1.5 w-1.5 rounded-full bg-zinc-300"
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
        className="text-2xl font-semibold tracking-tight text-zinc-900"
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
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 divide-y divide-zinc-100">
            {accounts.map((account, i) => (
              <motion.div
                key={account.id || account.account_id || i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.75 + i * 0.05 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="relative h-8 w-8 flex-shrink-0">
                  {institution?.logo && (
                    <img
                      src={institution.logo}
                      alt={institution.name || ""}
                      className="h-8 w-8 rounded-full object-contain bg-white border border-zinc-100 absolute inset-0"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  )}
                  <div className="h-8 w-8 rounded-full bg-zinc-200 flex items-center justify-center">
                    <span className="text-xs font-semibold text-zinc-500">
                      {(institution?.name || account.name || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-900 truncate">{account.name}</div>
                  <div className="text-xs text-zinc-400">
                    {formatSubtype(account.subtype)}
                    {account.mask ? ` · ••${account.mask}` : ""}
                  </div>
                </div>
                {account.balances?.current != null && (
                  <div className="text-sm tabular-nums text-zinc-500 flex-shrink-0">
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
        transition={{ delay: accounts.length > 0 ? 0.8 + accounts.length * 0.05 : 0.7 }}
        className="mt-4 text-sm text-zinc-400"
      >
        You can always add more from settings.
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: accounts.length > 0 ? 0.9 + accounts.length * 0.05 : 0.8 }}
        className="mt-6 flex flex-col items-center gap-3 w-full max-w-xs"
      >
        <Button onClick={onComplete} className="w-full h-11">
          Continue to dashboard
          <FiChevronRight className="ml-1.5 h-4 w-4" />
        </Button>
        <button
          type="button"
          onClick={onAddMore}
          className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 active:scale-[0.97] transition-all duration-150 cursor-pointer"
        >
          <FiPlus className="h-4 w-4" />
          Connect another account
        </button>
      </motion.div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────── */
/**
 * AccountSetupFlow
 *
 * Props:
 *   initialStep   - which step to start on (0=email/pw, 1=name, 2=account type, 3=connecting, 4=connected)
 *   userName      - pre-resolved first name (skips to the appropriate step if already named)
 *   onComplete    - called when the user finishes the flow
 *   onFlowStart   - called when Plaid link is about to open
 */
export default function AccountSetupFlow({ initialStep = 0, userName, onComplete = null, onFlowStart = null }) {
  const [step, setStep] = useState(initialStep);
  const [direction, setDirection] = useState(1);
  const [selectedAccountType, setSelectedAccountType] = useState(null);
  const [plaidData, setPlaidData] = useState(null);
  const [resolvedFirstName, setResolvedFirstName] = useState(() => {
    if (!userName) return null;
    return capitalizeFirstOnly(String(userName).split(" ")[0]);
  });

  const firstName = resolvedFirstName || "there";

  const goTo = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  const handleEmailPasswordNext = (email) => {
    // Account created, move to Name step
    goTo(1);
  };

  const handleNameNext = (name) => {
    setResolvedFirstName(name);
    goTo(2);
  };

  const handleAccountTypeSelect = (type) => {
    setSelectedAccountType(type);
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

  const handleAddMore = () => {
    setSelectedAccountType(null);
    goTo(2);
  };

  const handleComplete = () => {
    onComplete?.(plaidData);
  };

  const stepContent = () => {
    switch (step) {
      case 0:
        return (
          <EmailPasswordStep
            key="email-password"
            onNext={handleEmailPasswordNext}
          />
        );
      case 1:
        return (
          <NameStep
            key="name"
            onNext={handleNameNext}
            onBack={step > initialStep ? () => goTo(0) : null}
          />
        );
      case 2:
        return (
          <AccountTypeStep
            key="account-type"
            onSelect={handleAccountTypeSelect}
            onBack={() => goTo(1)}
          />
        );
      case 3:
        return (
          <ConnectingStep
            key={`connecting-${selectedAccountType?.id}`}
            accountType={selectedAccountType}
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
