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
    <div className="relative overflow-hidden rounded-2xl p-6" style={{
      background: 'linear-gradient(135deg, #0a1628 0%, #0f2847 40%, #133a6b 100%)',
    }}>
      {/* Abstract blob shape — right side */}
      <div className="absolute inset-0 overflow-hidden">
        <svg
          className="absolute -right-8 -top-8 -bottom-8"
          width="65%"
          height="120%"
          viewBox="0 0 300 400"
          fill="none"
          preserveAspectRatio="none"
        >
          <defs>
            <radialGradient id="blob-grad-1" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#2563eb" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#1d4ed8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="blob-grad-2" cx="60%" cy="60%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="60%" stopColor="#2563eb" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0" />
            </radialGradient>
            <filter id="blob-blur">
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>
          {/* Primary blob */}
          <path
            d="M120,20 C200,-10 310,60 280,150 C260,220 300,290 250,350 C200,400 130,380 100,320 C60,250 20,280 40,200 C55,140 60,50 120,20 Z"
            fill="url(#blob-grad-1)"
            filter="url(#blob-blur)"
          />
          {/* Secondary blob — offset for depth */}
          <path
            d="M160,50 C230,20 290,100 270,180 C250,260 280,330 220,370 C160,400 100,350 90,280 C75,210 50,230 70,160 C90,100 110,70 160,50 Z"
            fill="url(#blob-grad-2)"
            filter="url(#blob-blur)"
          />
          {/* Bright highlight accent */}
          <ellipse
            cx="200"
            cy="160"
            rx="60"
            ry="80"
            fill="#3b82f6"
            opacity="0.08"
            filter="url(#blob-blur)"
          />
        </svg>

        {/* Subtle noise texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
      </div>

      <div className="relative">
        {/* Header with larger logo */}
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="h-7 w-7 bg-white/70"
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
          <span className="text-xs font-semibold tracking-wider uppercase text-blue-300/60">
            Pro
          </span>
        </div>

        <h3 className="text-base font-semibold text-white mb-1.5">
          Unlock the full picture
        </h3>
        <p className="text-xs text-blue-200/40 mb-5 leading-relaxed max-w-[75%]">
          Budgets, recurring bills, and portfolio tracking — all in one place.
        </p>

        {/* Feature list */}
        <div className="space-y-2.5 mb-6">
          {features.map((label) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-1 h-1 rounded-full bg-blue-400/40" />
              <span className="text-[13px] text-blue-100/60">{label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full h-9 rounded-lg bg-white text-[#0f2847] text-xs font-semibold transition-all hover:bg-blue-50 disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Redirecting..." : "Upgrade to Pro"}
        </button>
      </div>
    </div>
  );
}
