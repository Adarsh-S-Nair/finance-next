"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiCheck, FiX } from "react-icons/fi";
import { HiSparkles } from "react-icons/hi2";
import { useUser } from "./providers/UserProvider";
import { useToast } from "./providers/ToastProvider";
import { authFetch } from "../lib/api/fetch";

const PRO_FEATURES = [
  "Unlimited bank connections",
  "Investment portfolio tracking",
  "Recurring transactions analysis",
  "AI-powered financial insights",
  "Priority support",
];

export default function UpgradeModal({ isOpen, onClose }) {
  const { refreshProfile } = useUser();
  const { setToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/subscription/upgrade", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setToast({
          title: "Upgrade failed",
          description: body.error || "Something went wrong",
          variant: "error",
        });
        return;
      }
      await refreshProfile();
      setToast({
        title: "Welcome to Pro! 🎉",
        description: "Your account has been upgraded to Pro.",
        variant: "success",
      });
      onClose();
    } catch (err) {
      setToast({ title: "Upgrade failed", description: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-sm bg-[var(--color-bg)] rounded-2xl shadow-xl border border-[var(--color-border)] overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors"
              aria-label="Close"
            >
              <FiX className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="px-6 pt-6 pb-4 text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-[var(--color-accent)]/10 mb-4">
                <HiSparkles className="h-6 w-6 text-[var(--color-accent)]" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--color-fg)] tracking-tight">
                Upgrade to Pro
              </h2>
              <p className="mt-1.5 text-sm text-[var(--color-muted)]">
                Unlock the full power of your finances
              </p>
            </div>

            {/* Divider */}
            <div className="h-px mx-6 bg-[var(--color-border)]" />

            {/* Feature list */}
            <div className="px-6 py-4 space-y-3">
              {PRO_FEATURES.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="flex-shrink-0 h-5 w-5 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <FiCheck className="h-3 w-3 text-emerald-500" strokeWidth={3} />
                  </div>
                  <span className="text-sm text-[var(--color-fg)]">{feature}</span>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px mx-6 bg-[var(--color-border)]" />

            {/* Pricing + CTA */}
            <div className="px-6 py-5">
              <div className="flex items-baseline gap-1 justify-center mb-4">
                <span className="text-3xl font-bold text-[var(--color-fg)]">$9</span>
                <span className="text-sm text-[var(--color-muted)]">/month</span>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <HiSparkles className="h-4 w-4" />
                    Upgrade Now
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
                Cancel anytime. No hidden fees.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
