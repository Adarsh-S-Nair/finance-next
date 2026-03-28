"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiCheck, FiX } from "react-icons/fi";
import { useUser } from "./providers/UserProvider";
import { useToast } from "./providers/ToastProvider";
import { authFetch } from "../lib/api/fetch";
import { getTierDisplayFeatures } from "../lib/tierConfigClient";

const FREE_FEATURES = getTierDisplayFeatures("free");
const PRO_FEATURES = getTierDisplayFeatures("pro");

interface UpgradeOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpgradeOverlay({ isOpen, onClose }: UpgradeOverlayProps) {
  const { refreshProfile } = useUser();
  const { setToast } = useToast();
  const [loading, setLoading] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/stripe/checkout", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setToast({
          title: "Upgrade failed",
          description: body.error || "Something went wrong",
          variant: "error",
        });
        return;
      }
      if (body.url) {
        // Redirect to Stripe Checkout — page will navigate away
        window.location.href = body.url;
        return;
      }
      // Fallback: if no URL returned, refresh profile (shouldn't happen)
      await refreshProfile();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setToast({ title: "Upgrade failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "var(--color-bg)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface)] transition-colors cursor-pointer z-10"
            aria-label="Close"
          >
            <FiX className="h-5 w-5" />
          </button>

          {/* Content container */}
          <motion.div
            className="w-full max-w-3xl"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-[var(--color-fg)]">Choose your plan</h2>
              <p className="text-sm text-[var(--color-muted)] mt-2">Upgrade anytime. Cancel anytime.</p>
            </div>

            {/* Cards */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch">
              {/* Free card */}
              <div className="flex-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 flex flex-col">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-medium text-[var(--color-fg)]">Free</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/10 text-[var(--color-muted)]">
                    Current Plan
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-semibold text-[var(--color-fg)]">$0</span>
                  <span className="text-sm text-[var(--color-muted)]">/month</span>
                </div>
                <ul className="space-y-3 flex-1">
                  {FREE_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <FiCheck className="h-4 w-4 flex-shrink-0 text-[var(--color-muted)]" strokeWidth={2.5} />
                      <span className="text-sm text-[var(--color-muted)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <div className="w-full h-10 inline-flex items-center justify-center rounded-xl border border-[var(--color-border)] text-sm text-[var(--color-muted)]">
                    Current Plan
                  </div>
                </div>
              </div>

              {/* Pro card */}
              <div
                className="flex-1 rounded-2xl border-2 bg-[var(--color-bg)] p-6 flex flex-col relative overflow-hidden"
                style={{ borderColor: "var(--color-accent)" }}
              >
                {/* Recommended badge */}
                <div
                  className="absolute top-0 right-6 px-3 py-1 rounded-b-lg text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ background: "var(--color-accent)" }}
                >
                  Recommended
                </div>

                {/* Subtle accent glow */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: "radial-gradient(ellipse at top right, var(--color-accent) 0%, transparent 60%)",
                    opacity: 0.06,
                  }}
                />

                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-medium text-[var(--color-fg)]">Pro</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-semibold text-[var(--color-fg)]">$9</span>
                  <span className="text-sm text-[var(--color-muted)]">/month</span>
                </div>
                <ul className="space-y-3 flex-1">
                  {PRO_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <FiCheck className="h-4 w-4 flex-shrink-0 text-emerald-500" strokeWidth={2.5} />
                      <span className="text-sm text-[var(--color-muted)]">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  <button
                    onClick={handleUpgrade}
                    disabled={loading}
                    className="w-full h-10 inline-flex items-center justify-center rounded-xl text-sm font-medium text-white hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                    style={{ background: "var(--color-accent)" }}
                  >
                    {loading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      "Upgrade to Pro"
                    )}
                  </button>
                  <p className="mt-3 text-center text-xs text-[var(--color-muted)]">Cancel anytime</p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
