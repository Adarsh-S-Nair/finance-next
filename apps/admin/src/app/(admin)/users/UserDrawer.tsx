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
};

/**
 * User detail + actions drawer. The delete path proxies through the admin
 * server, which forwards a Bearer token to the finance API's
 * /api/admin/users/[id] — that runs the same `deleteUserCompletely`
 * helper the user-facing self-delete uses, so Plaid /item/remove and
 * Stripe cleanup always fire.
 */
export default function UserDrawer({ user, onClose, onDeleted }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPro = user?.subscription_tier === "pro";
  const status = user?.subscription_status;

  async function handleDelete() {
    if (!user) return;
    setBusy(true);
    setError(null);
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
      setError(err?.message || "Delete failed");
    } finally {
      setBusy(false);
      setShowConfirm(false);
    }
  }

  return (
    <>
      <Drawer
        isOpen={!!user}
        onClose={onClose}
        size="md"
        title="User"
      >
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
              <h3 className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-danger)] mb-3">
                Danger zone
              </h3>
              <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-5">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-fg)]">
                      Delete user
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-muted)] leading-relaxed">
                      Removes all their Plaid connections (via Plaid{" "}
                      <code className="text-[var(--color-muted)]">/item/remove</code>
                      ), cancels any active Stripe subscriptions, deletes their data,
                      and removes their auth account. Cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    onClick={() => setShowConfirm(true)}
                    disabled={busy}
                  >
                    Delete
                  </Button>
                </div>
                {error && (
                  <p className="mt-3 text-xs text-[var(--color-danger)]">{error}</p>
                )}
              </div>
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
            ? `This will permanently delete ${fullName(user)} (${user.email ?? "no email"}). Their Plaid items will be removed and their Stripe subscriptions cancelled.`
            : ""
        }
        confirmLabel="Delete user"
        busyLabel="Deleting..."
        cancelLabel="Cancel"
        variant="danger"
        requiredText="delete user"
        showRequiredTextUppercase
        busy={busy}
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
