"use client";

import { useEffect, useState } from "react";
import { FiShield, FiX } from "react-icons/fi";
import Link from "next/link";
import { authFetch } from "../lib/api/fetch";

type Grant = {
  id: string;
  status: string;
  expires_at: string | null;
  decided_at: string | null;
  duration_seconds: number;
  requested_at: string;
  reason: string | null;
  requester_email: string | null;
};

function formatDuration(seconds: number): string {
  if (seconds >= 86_400) return `${seconds / 86_400}d`;
  if (seconds >= 3_600) return `${Math.round(seconds / 3_600)}h`;
  return `${Math.round(seconds / 60)}m`;
}

/**
 * Top-of-app banner shown when an admin has requested impersonation
 * access. Inline approve/deny/dismiss; deeper management lives at
 * /settings/support-access. We only show the OLDEST pending request to
 * keep the bar single-line — additional requests appear as the user
 * acts on each.
 */
export default function ImpersonationRequestBanner() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await authFetch("/api/account/impersonation");
        if (!res.ok) return;
        const body = await res.json();
        if (cancelled) return;
        setGrants((body?.grants as Grant[]) ?? []);
      } catch {
        // Silent failure — banner just won't show. Not load-bearing UX.
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const pending = grants
    .filter((g) => g.status === "pending" && !hidden.has(g.id))
    .sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime());
  const target = pending[0];
  if (!target) return null;

  async function decide(id: string, action: "approve" | "deny") {
    setBusy(id);
    try {
      const res = await authFetch(`/api/account/impersonation/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const body = await res.json();
        const updated = body?.grant as Grant | undefined;
        if (updated) {
          setGrants((prev) =>
            prev.map((g) => (g.id === updated.id ? { ...g, ...updated } : g)),
          );
        }
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-[var(--color-accent)]/10 border-b border-[var(--color-accent)]/20 px-4 py-2.5 flex items-center justify-center gap-3 text-sm flex-wrap">
      <FiShield className="h-4 w-4 text-[var(--color-accent)] flex-shrink-0" />
      <span className="text-[var(--color-fg)]">
        <strong className="font-medium">
          {target.requester_email ?? "An admin"}
        </strong>{" "}
        is requesting access to your account
        {target.reason ? <> — “{target.reason}”</> : ""}.
      </span>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => decide(target.id, "approve")}
          disabled={busy === target.id}
          className="text-xs font-medium px-2.5 py-1 rounded bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
        >
          {busy === target.id ? "…" : `Approve ${formatDuration(target.duration_seconds)}`}
        </button>
        <button
          onClick={() => decide(target.id, "deny")}
          disabled={busy === target.id}
          className="text-xs font-medium text-[var(--color-fg)] hover:underline disabled:opacity-50"
        >
          Deny
        </button>
        <Link
          href="/settings/support-access"
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          Details
        </Link>
        <button
          onClick={() => setHidden((s) => new Set(s).add(target.id))}
          className="p-0.5 rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
          aria-label="Dismiss"
        >
          <FiX className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
