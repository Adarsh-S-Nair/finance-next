"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageContainer from "../../../../components/layout/PageContainer";
import { authFetch } from "../../../../lib/api/fetch";

type Grant = {
  id: string;
  status: string;
  expires_at: string | null;
  decided_at: string | null;
  duration_seconds: number;
  requested_at: string;
  reason: string | null;
  requester_id: string;
  requester_email: string | null;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const past = diff >= 0;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60_000);
  if (mins < 1) return past ? "just now" : "now";
  if (mins < 60) return past ? `${mins}m ago` : `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return past ? `${hours}h ago` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return past ? `${days}d ago` : `in ${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isActive(g: Grant): boolean {
  return g.status === "approved" && !!g.expires_at && new Date(g.expires_at).getTime() > Date.now();
}

const STATUS_COPY: Record<string, string> = {
  pending: "Pending",
  approved: "Active",
  denied: "Denied",
  revoked: "Revoked",
  expired: "Expired",
};

export default function SupportAccessPage() {
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await authFetch("/api/account/impersonation?all=1");
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Could not load");
      setGrants((body?.grants as Grant[]) ?? []);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || "Could not load");
      setGrants([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, action: "approve" | "deny" | "revoke") {
    setBusyId(id);
    setError(null);
    try {
      const res = await authFetch(`/api/account/impersonation/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Failed");
      const updated = body?.grant as Grant | undefined;
      if (updated) {
        setGrants((prev) =>
          (prev ?? []).map((g) => (g.id === updated.id ? { ...g, ...updated } : g)),
        );
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message || "Failed");
    } finally {
      setBusyId(null);
    }
  }

  const sorted = (grants ?? []).slice().sort((a, b) => {
    // Open (pending or active) first, then by requested_at desc.
    const aOpen = a.status === "pending" || isActive(a) ? 1 : 0;
    const bOpen = b.status === "pending" || isActive(b) ? 1 : 0;
    if (aOpen !== bOpen) return bOpen - aOpen;
    return new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime();
  });

  return (
    <PageContainer title="Support access">
      <div className="max-w-2xl mx-auto space-y-6">
        <p className="text-sm text-[var(--color-muted)]">
          Admins can request temporary access to your account for support. Approve only
          if you trust the requester — they&apos;ll be able to see and act in your
          account until the grant expires or you revoke it.{" "}
          <Link href="/settings" className="underline hover:no-underline">
            Back to settings
          </Link>
        </p>

        {error && (
          <div className="text-xs text-[var(--color-danger)]/80">{error}</div>
        )}

        {grants === null ? (
          <div className="text-sm text-[var(--color-muted)]">Loading…</div>
        ) : sorted.length === 0 ? (
          <div className="text-sm text-[var(--color-muted)] py-8 text-center border-t border-b border-[var(--color-fg)]/[0.06]">
            No requests yet.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-fg)]/[0.06] border-t border-b border-[var(--color-fg)]/[0.06]">
            {sorted.map((g) => {
              const active = isActive(g);
              const open = g.status === "pending" || active;
              return (
                <li key={g.id} className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-fg)] truncate">
                          {g.requester_email ?? "Unknown admin"}
                        </span>
                        <span
                          className={
                            active
                              ? "text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-success)]"
                              : g.status === "pending"
                                ? "text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--color-accent)]"
                                : "text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)]/70"
                          }
                        >
                          {STATUS_COPY[g.status] ?? g.status}
                        </span>
                      </div>
                      {g.reason && (
                        <div className="text-xs text-[var(--color-muted)] mt-0.5 italic">
                          “{g.reason}”
                        </div>
                      )}
                      <div className="text-[11px] text-[var(--color-muted)]/70 mt-1">
                        Requested {formatRelative(g.requested_at)}
                        {g.decided_at && (
                          <>
                            {" · "}
                            {g.status === "approved" ? "approved" : g.status}{" "}
                            {formatRelative(g.decided_at)}
                          </>
                        )}
                        {active && g.expires_at && <> · expires {formatRelative(g.expires_at)}</>}
                      </div>
                    </div>
                    {open && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {g.status === "pending" ? (
                          <>
                            <button
                              onClick={() => decide(g.id, "approve")}
                              disabled={busyId === g.id}
                              className="text-xs font-medium px-2.5 py-1 rounded bg-[var(--color-accent)] text-[var(--color-on-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
                            >
                              {busyId === g.id ? "…" : "Approve"}
                            </button>
                            <button
                              onClick={() => decide(g.id, "deny")}
                              disabled={busyId === g.id}
                              className="text-xs font-medium text-[var(--color-fg)] hover:underline disabled:opacity-50"
                            >
                              Deny
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => decide(g.id, "revoke")}
                            disabled={busyId === g.id}
                            className="text-xs font-medium text-[var(--color-danger)] hover:underline disabled:opacity-50"
                          >
                            {busyId === g.id ? "…" : "Revoke"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageContainer>
  );
}
