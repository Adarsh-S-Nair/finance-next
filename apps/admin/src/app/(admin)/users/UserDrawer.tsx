"use client";

import { useEffect, useState } from "react";
import { Button, ConfirmOverlay, Drawer } from "@zervo/ui";
import { billableLinesForItem, formatUsd } from "@/lib/plaidPricing";
import {
  type AdminUserRow,
  formatDate,
  formatRelative,
  fullName,
  initials,
} from "./UsersClient";

type Grant = {
  id: string;
  status: string;
  expires_at: string | null;
  decided_at: string | null;
  duration_seconds: number;
  requested_at: string;
  reason: string | null;
};

function isActive(g: Grant): boolean {
  return g.status === "approved" && !!g.expires_at && new Date(g.expires_at).getTime() > Date.now();
}

function isOpen(g: Grant): boolean {
  return g.status === "pending" || isActive(g);
}

function formatExpiresIn(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

type Props = {
  user: AdminUserRow | null;
  onClose: () => void;
  onDeleted: () => void;
  onSubscriptionChanged: (patch: Partial<AdminUserRow>) => void;
};

/**
 * User detail + actions drawer. Delete proxies through the admin server
 * to finance's /api/admin/users/[id], which runs the same
 * `deleteUserCompletely` helper as the user-facing self-delete so Plaid
 * /item/remove and Stripe cleanup always fire. Subscription toggles go
 * through the same proxy → finance → subscriptionActions pattern.
 */
export default function UserDrawer({
  user,
  onClose,
  onDeleted,
  onSubscriptionChanged,
}: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [subBusy, setSubBusy] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantError, setGrantError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(86_400);
  const [reason, setReason] = useState("");

  const isPro = user?.subscription_tier === "pro";
  const status = user?.subscription_status;
  const openGrant = grants?.find((g) => isOpen(g)) ?? null;
  const lastGrant = grants?.[0] ?? null;

  useEffect(() => {
    if (!user) {
      setGrants(null);
      setGrantError(null);
      setReason("");
      return;
    }
    let cancelled = false;
    setGrantsLoading(true);
    setGrantError(null);
    fetch(`/api/impersonation?target=${encodeURIComponent(user.id)}`, { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setGrantError(body?.error || "Could not load grants");
          setGrants([]);
          return;
        }
        setGrants((body?.grants as Grant[]) ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setGrantError(e?.message || "Could not load grants");
        setGrants([]);
      })
      .finally(() => {
        if (!cancelled) setGrantsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function requestImpersonation() {
    if (!user) return;
    setGrantBusy(true);
    setGrantError(null);
    try {
      const res = await fetch(`/api/impersonation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: user.id,
          duration_seconds: duration,
          reason: reason.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Request failed");
      const newGrant = body.grant as Grant | undefined;
      if (newGrant) {
        setGrants((prev) => {
          const others = (prev ?? []).filter((g) => g.id !== newGrant.id);
          return [newGrant, ...others];
        });
        setReason("");
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      setGrantError(err?.message || "Request failed");
    } finally {
      setGrantBusy(false);
    }
  }

  async function cancelImpersonation(grantId: string) {
    setGrantBusy(true);
    setGrantError(null);
    try {
      const res = await fetch(`/api/impersonation/${encodeURIComponent(grantId)}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Cancel failed");
      const updated = body.grant as Grant | undefined;
      if (updated) {
        setGrants((prev) =>
          (prev ?? []).map((g) => (g.id === updated.id ? updated : g)),
        );
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      setGrantError(err?.message || "Cancel failed");
    } finally {
      setGrantBusy(false);
    }
  }

  async function handleDelete() {
    if (!user) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Delete failed");
      }
      onDeleted();
    } catch (e: unknown) {
      const err = e as { message?: string };
      setDeleteError(err?.message || "Delete failed");
    } finally {
      setDeleteBusy(false);
      setShowConfirm(false);
    }
  }

  async function updateSubscription(action: "grant_pro" | "revoke_pro") {
    if (!user) return;
    setSubBusy(true);
    setSubError(null);
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(user.id)}/subscription`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Subscription update failed");
      }
      onSubscriptionChanged(
        action === "grant_pro"
          ? { subscription_tier: "pro", subscription_status: "active" }
          : { subscription_tier: "free", subscription_status: "canceled" },
      );
    } catch (e: unknown) {
      const err = e as { message?: string };
      setSubError(err?.message || "Subscription update failed");
    } finally {
      setSubBusy(false);
    }
  }

  return (
    <>
      <Drawer isOpen={!!user} onClose={onClose} size="md" title="User">
        {user && (
          <div className="space-y-8 pt-2">
            <div className="flex items-center gap-4">
              <div className="relative h-14 w-14 rounded-full bg-[var(--color-accent)] flex items-center justify-center overflow-hidden text-sm font-semibold text-[var(--color-on-accent)]">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span>{initials(user)}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium text-[var(--color-fg)] truncate">
                    {fullName(user)}
                  </span>
                  {isPro && (
                    <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent)] font-semibold">
                      pro
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-[var(--color-muted)] truncate">
                  {user.email ?? "—"}
                </div>
              </div>
            </div>

            <section>
              <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-3">
                Details
              </h3>
              <dl className="divide-y divide-[var(--color-fg)]/[0.06] border-t border-b border-[var(--color-fg)]/[0.06]">
                <Row label="User ID" value={user.id} mono />
                <Row label="Joined" value={formatDate(user.created_at)} />
                <Row label="Last seen" value={formatRelative(user.last_active_at)} />
                <Row label="Tier" value={user.subscription_tier ?? "free"} />
                <Row
                  label="Subscription status"
                  value={status ?? (isPro ? "active" : "—")}
                />
              </dl>
            </section>

            <section>
              <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-3">
                Subscription
              </h3>
              <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-4 flex items-center justify-between gap-4">
                <div className="text-sm text-[var(--color-fg)]">
                  {isPro ? "Pro" : "Free"}
                </div>
                {isPro ? (
                  <Button
                    variant="dangerSubtle"
                    size="sm"
                    onClick={() => updateSubscription("revoke_pro")}
                    disabled={subBusy}
                  >
                    {subBusy ? "Revoking..." : "Revoke Pro"}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => updateSubscription("grant_pro")}
                    disabled={subBusy}
                  >
                    {subBusy ? "Granting..." : "Grant Pro"}
                  </Button>
                )}
              </div>
              {subError && (
                <p className="mt-2 text-xs text-[var(--color-danger)]/80">{subError}</p>
              )}
            </section>

            <section>
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]/60">
                  Plaid usage
                </h3>
                <span className="text-[11px] text-[var(--color-muted)]/60 tabular-nums">
                  est. {formatUsd(user.plaid_monthly_cost)} / mo
                </span>
              </div>
              {user.plaid_items.length === 0 ? (
                <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-4 text-xs text-[var(--color-muted)]">
                  No Plaid items connected.
                </div>
              ) : (
                <ul className="divide-y divide-[var(--color-fg)]/[0.06] border-t border-b border-[var(--color-fg)]/[0.06]">
                  {user.plaid_items.map((item) => {
                    const lines = billableLinesForItem(item, item.account_types);
                    const typeCounts = item.account_types.reduce<Record<string, number>>(
                      (acc, t) => {
                        const k = t ?? "unknown";
                        acc[k] = (acc[k] ?? 0) + 1;
                        return acc;
                      },
                      {},
                    );
                    const typeSummary = Object.entries(typeCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([t, n]) => `${n} ${t}`)
                      .join(" · ");
                    return (
                      <li key={item.id} className="py-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="font-mono text-[11px] text-[var(--color-fg)] truncate">
                            {item.item_id}
                          </span>
                          <span className="text-xs tabular-nums text-[var(--color-fg)] flex-shrink-0">
                            {formatUsd(item.monthly_cost)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                          {item.account_count} account{item.account_count === 1 ? "" : "s"}
                          {typeSummary && (
                            <span className="text-[var(--color-muted)]/60">
                              {" · "}
                              {typeSummary}
                            </span>
                          )}
                        </div>
                        {lines.length > 0 ? (
                          <ul className="mt-2 space-y-0.5 text-[11px]">
                            {lines.map((line) => (
                              <li
                                key={line.label}
                                className="flex items-baseline justify-between gap-3 text-[var(--color-muted)]"
                              >
                                <span>{line.label}</span>
                                <span className="tabular-nums text-[var(--color-fg)]">
                                  {formatUsd(line.rate)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="mt-1 text-[11px] text-[var(--color-muted)]/60">
                            no billable products for these account types
                          </div>
                        )}
                        {item.sync_status && item.sync_status !== "idle" && (
                          <div className="mt-1 text-[11px] text-[var(--color-muted)]/70">
                            status: {item.sync_status}
                            {item.last_error ? ` · ${item.last_error}` : ""}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-3">
                Impersonation
              </h3>
              <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-4 space-y-3">
                {grantsLoading && !grants ? (
                  <div className="text-xs text-[var(--color-muted)]">Loading…</div>
                ) : openGrant && openGrant.status === "pending" ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-[var(--color-fg)]">
                        Pending — awaiting user approval
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        Requested {formatRelative(openGrant.requested_at)} ·{" "}
                        {Math.round(openGrant.duration_seconds / 3600)}h grant
                      </div>
                    </div>
                    <Button
                      variant="dangerSubtle"
                      size="sm"
                      onClick={() => cancelImpersonation(openGrant.id)}
                      disabled={grantBusy}
                    >
                      {grantBusy ? "Canceling…" : "Cancel"}
                    </Button>
                  </div>
                ) : openGrant && isActive(openGrant) ? (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm text-[var(--color-success)] font-medium">
                        Active — expires in {formatExpiresIn(openGrant.expires_at)}
                      </div>
                      <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
                        Approved {formatRelative(openGrant.decided_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled
                        title="Enter session — coming next commit"
                      >
                        Enter session
                      </Button>
                      <Button
                        variant="dangerSubtle"
                        size="sm"
                        onClick={() => cancelImpersonation(openGrant.id)}
                        disabled={grantBusy}
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lastGrant && (
                      <div className="text-[11px] text-[var(--color-muted)]">
                        Last request: {lastGrant.status} ·{" "}
                        {formatRelative(lastGrant.decided_at ?? lastGrant.requested_at)}
                      </div>
                    )}
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="text-[11px] text-[var(--color-muted)]/70 uppercase tracking-[0.08em]">
                        Duration
                      </label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="bg-[var(--color-input-bg)] text-[var(--color-input-fg)] text-xs rounded px-2 py-1 outline-none"
                        disabled={grantBusy}
                      >
                        <option value={3_600}>1 hour</option>
                        <option value={86_400}>24 hours</option>
                        <option value={604_800}>7 days</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Reason (optional, shown to user)"
                      maxLength={500}
                      disabled={grantBusy}
                      className="w-full bg-[var(--color-input-bg)] text-[var(--color-input-fg)] text-xs rounded px-2 py-1.5 outline-none placeholder:text-[var(--color-input-placeholder)]"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={requestImpersonation}
                      disabled={grantBusy}
                    >
                      {grantBusy ? "Requesting…" : "Request access"}
                    </Button>
                  </div>
                )}
              </div>
              {grantError && (
                <p className="mt-2 text-xs text-[var(--color-danger)]/80">{grantError}</p>
              )}
            </section>

            <section>
              <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-3">
                Danger zone
              </h3>
              <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-4 flex items-center justify-between gap-4">
                <div className="text-sm text-[var(--color-fg)]">Delete user</div>
                <Button
                  variant="dangerSubtle"
                  size="sm"
                  onClick={() => setShowConfirm(true)}
                  disabled={deleteBusy}
                >
                  Delete
                </Button>
              </div>
              {deleteError && (
                <p className="mt-2 text-xs text-[var(--color-danger)]/80">{deleteError}</p>
              )}
            </section>
          </div>
        )}
      </Drawer>

      <ConfirmOverlay
        isOpen={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Delete user"
        description={
          user
            ? `Permanently delete ${fullName(user)} (${user.email ?? "no email"}).`
            : ""
        }
        confirmLabel="Delete user"
        busyLabel="Deleting..."
        cancelLabel="Cancel"
        variant="danger"
        requiredText="delete user"
        showRequiredTextUppercase
        busy={deleteBusy}
      />
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 text-xs">
      <dt className="text-[var(--color-muted)]/70 flex-shrink-0">{label}</dt>
      <dd
        className={
          mono
            ? "font-mono text-[var(--color-fg)] truncate"
            : "text-[var(--color-fg)] truncate"
        }
      >
        {value}
      </dd>
    </div>
  );
}
