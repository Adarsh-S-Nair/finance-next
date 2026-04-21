"use client";

import { useState } from "react";
import { Button, ConfirmOverlay, Drawer } from "@zervo/ui";
import {
  type AdminUserRow,
  formatDate,
  formatRelative,
  fullName,
  initials,
} from "./UsersClient";

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

  const isPro = user?.subscription_tier === "pro";
  const status = user?.subscription_status;

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
                  // eslint-disable-next-line @next/next/no-img-element
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
                <Row label="Last seen" value={formatRelative(user.last_sign_in_at)} />
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
