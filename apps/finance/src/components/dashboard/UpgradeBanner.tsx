"use client";

import { useState } from "react";
import { Button } from "@zervo/ui";
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
    <div className="w-full bg-[var(--color-surface-alt)] p-5">
      <span className="card-header">Zervo Pro</span>

      <h3 className="mt-3 text-base font-semibold leading-snug text-[var(--color-fg)]">
        Unlock the full picture.
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
        Budgets, recurring bills, and portfolio tracking — all in one place.
      </p>

      <ul className="mt-5 space-y-2">
        {features.map((label) => (
          <li
            key={label}
            className="flex items-center gap-2.5 text-[13px] text-[var(--color-fg)]"
          >
            <span className="h-1 w-1 rounded-full bg-[var(--color-muted)]" />
            {label}
          </li>
        ))}
      </ul>

      <Button
        variant="primary"
        size="md"
        fullWidth
        onClick={handleUpgrade}
        disabled={loading}
        className="mt-5"
      >
        {loading ? "Redirecting…" : "Upgrade to Pro"}
      </Button>
    </div>
  );
}
