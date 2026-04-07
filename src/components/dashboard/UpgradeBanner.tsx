"use client";

import { useState } from "react";
import { useUser } from "../providers/UserProvider";
import { authFetch } from "../../lib/api/fetch";
import { useToast } from "../providers/ToastProvider";

export default function UpgradeBanner() {
  const { refreshProfile } = useUser();
  const { setToast } = useToast();
  const [loading, setLoading] = useState(false);

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
        window.location.href = body.url;
        return;
      }
      await refreshProfile();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setToast({ title: "Upgrade failed", description: message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const features = [
    "Budget tracking",
    "Recurring transactions",
    "Investment portfolio",
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a2a2f] to-[#1a1a1d] p-6">
      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Decorative accent circles */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/[0.03]" />
      <div className="absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-white/[0.02]" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div
            className="h-4 w-4 bg-white/50"
            style={{
              maskImage: "url(/logo.svg)",
              maskSize: "contain",
              maskRepeat: "no-repeat",
              maskPosition: "center",
              WebkitMaskImage: "url(/logo.svg)",
              WebkitMaskSize: "contain",
              WebkitMaskRepeat: "no-repeat",
              WebkitMaskPosition: "center",
            }}
          />
          <span className="text-[11px] font-semibold tracking-wide uppercase text-white/40">
            Pro
          </span>
        </div>

        <h3 className="text-[15px] font-semibold text-white mb-1">
          Unlock the full picture
        </h3>
        <p className="text-xs text-white/40 mb-5 leading-relaxed">
          Budgets, recurring bills, and portfolio tracking — all in one place.
        </p>

        {/* Feature list */}
        <div className="space-y-2 mb-6">
          {features.map((label) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-white/30" />
              <span className="text-[13px] text-white/60">{label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full h-9 rounded-lg bg-white text-[#1a1a1d] text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Redirecting..." : "Upgrade to Pro"}
        </button>
      </div>
    </div>
  );
}
