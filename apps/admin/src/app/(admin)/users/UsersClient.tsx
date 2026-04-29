"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlaidItemRow } from "@/lib/plaidPricing";
import UserDrawer from "./UserDrawer";

export type PlaidItemWithCost = PlaidItemRow & {
  account_types: (string | null)[];
  account_count: number;
  monthly_cost: number;
};

export type AdminUserRow = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_active_at: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  plaid_items: PlaidItemWithCost[];
  plaid_monthly_cost: number;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fullName(u: AdminUserRow): string {
  const parts = [u.first_name, u.last_name].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ");
  return u.email?.split("@")[0] ?? "—";
}

export function initials(u: AdminUserRow): string {
  if (u.first_name && u.last_name) return `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
  if (u.first_name) return u.first_name[0]!.toUpperCase();
  if (u.email) return u.email[0]!.toUpperCase();
  return "?";
}

export { formatDate, formatRelative };

export default function UsersClient({ users }: { users: AdminUserRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<AdminUserRow | null>(null);

  return (
    <>
      <ul className="border-t border-b border-[var(--color-fg)]/[0.06] divide-y divide-[var(--color-fg)]/[0.06]">
        {users.map((u) => {
          const isPro = u.subscription_tier === "pro";
          const status = u.subscription_status;
          return (
            <li key={u.id}>
              <button
                type="button"
                onClick={() => setSelected(u)}
                style={{ gridTemplateColumns: "auto minmax(0, 1.3fr) minmax(0, 1fr) auto" }}
                className="group relative grid w-full items-center gap-x-4 gap-y-0.5 py-3.5 px-3 -mx-3 rounded-md text-left transition-colors hover:bg-[var(--color-fg)]/[0.04] focus-visible:bg-[var(--color-fg)]/[0.04] outline-none"
              >
                <div className="row-span-2 relative h-9 w-9 flex-shrink-0 rounded-full bg-[var(--color-accent)] flex items-center justify-center overflow-hidden text-xs font-semibold text-[var(--color-on-accent)]">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span>{initials(u)}</span>
                  )}
                  {isPro && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-content-bg)]"
                      aria-hidden
                    />
                  )}
                </div>

                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-fg)] truncate">
                    {fullName(u)}
                  </span>
                  {isPro && (
                    <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent)] font-semibold">
                      pro
                    </span>
                  )}
                  {status && status !== "active" && isPro && (
                    <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-danger)] font-semibold">
                      {status}
                    </span>
                  )}
                </div>

                <div className="hidden md:grid grid-cols-2 gap-x-6 text-[11px] text-[var(--color-muted)]">
                  <Meta label="Joined" value={formatDate(u.created_at)} />
                  <Meta label="Last seen" value={formatRelative(u.last_active_at)} />
                </div>

                <span className="text-[var(--color-muted)]/40 text-lg flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100 row-span-2 self-center">
                  ›
                </span>

                <div className="min-w-0 text-xs text-[var(--color-muted)] truncate">
                  {u.email ?? "—"}
                </div>

                <div className="hidden md:block" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>

      <UserDrawer
        user={selected}
        onClose={() => setSelected(null)}
        onDeleted={() => {
          setSelected(null);
          router.refresh();
        }}
        onSubscriptionChanged={(patch) => {
          // Optimistically update the open drawer so the buttons flip
          // immediately; router.refresh() syncs the list from the server.
          setSelected((s) => (s ? { ...s, ...patch } : s));
          router.refresh();
        }}
      />
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 min-w-0">
      <span className="text-[var(--color-muted)]/50 flex-shrink-0">{label}</span>
      <span className="text-[var(--color-muted)] truncate">{value}</span>
    </div>
  );
}
