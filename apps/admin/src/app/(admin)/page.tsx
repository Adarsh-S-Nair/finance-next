import type { ReactNode } from "react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import AdminPageHeader from "@/components/AdminPageHeader";
import {
  estimateItemMonthlyCost,
  formatUsd,
  type PlaidItemRow,
} from "@/lib/plaidPricing";

type AccountRow = { item_id: string; type: string | null };

export const dynamic = "force-dynamic";

type RecentlyOnlineUser = {
  id: string;
  email: string | null;
  last_active_at: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  tier: string;
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const RECENT_WINDOW_MS = 60 * 60 * 1000;

type Presence = "online" | "recent" | "offline";

function presence(iso: string | null): Presence {
  if (!iso) return "offline";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < ONLINE_WINDOW_MS) return "online";
  if (diff < RECENT_WINDOW_MS) return "recent";
  return "offline";
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
  if (weeks < 4) return `${weeks}w ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fullName(first: string | null, last: string | null, email: string | null): string {
  const parts = [first, last].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return email?.split("@")[0] ?? "—";
}

function initials(first: string | null, last: string | null, email: string | null): string {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first[0]!.toUpperCase();
  if (email) return email[0]!.toUpperCase();
  return "?";
}

export default async function HomePage() {
  const admin = createAdminClient();

  const now = new Date();
  const last7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const prev30 = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: userCount },
    { count: proCount },
    { count: signupsLast30 },
    { count: signupsPrev30 },
    { count: activeLast7 },
    { data: authUsers },
    { data: profiles },
    { data: plaidItems },
    { data: accounts },
  ] = await Promise.all([
    admin.from("user_profiles").select("*", { count: "exact", head: true }),
    admin
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .eq("subscription_tier", "pro"),
    admin
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", last30),
    admin
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", prev30)
      .lt("created_at", last30),
    admin
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .gte("last_active_at", last7),
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin
      .from("user_profiles")
      .select("id, first_name, last_name, avatar_url, subscription_tier, last_active_at"),
    admin
      .from("plaid_items")
      .select(
        "id, user_id, item_id, products, recurring_ready, sync_status, last_error, created_at",
      ),
    admin.from("accounts").select("item_id, type"),
  ]);

  const accountTypesByItemId = new Map<string, (string | null)[]>();
  for (const row of (accounts ?? []) as AccountRow[]) {
    const list = accountTypesByItemId.get(row.item_id) ?? [];
    list.push(row.type);
    accountTypesByItemId.set(row.item_id, list);
  }

  type ProfileRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
    subscription_tier: string | null;
    last_active_at: string | null;
  };
  const profileById = new Map<string, ProfileRow>();
  for (const row of (profiles ?? []) as ProfileRow[]) {
    profileById.set(row.id, row);
  }

  const authById = new Map<string, { email: string | null }>();
  for (const u of authUsers?.users ?? []) {
    authById.set(u.id, { email: u.email ?? null });
  }

  const recentlyOnline: RecentlyOnlineUser[] = (profiles ?? [])
    .filter((p): p is ProfileRow => Boolean((p as ProfileRow).last_active_at))
    .sort((a, b) => {
      const ta = new Date((a as ProfileRow).last_active_at!).getTime();
      const tb = new Date((b as ProfileRow).last_active_at!).getTime();
      return tb - ta;
    })
    .slice(0, 5)
    .map((p) => {
      const row = p as ProfileRow;
      const auth = authById.get(row.id);
      return {
        id: row.id,
        email: auth?.email ?? null,
        last_active_at: row.last_active_at,
        first_name: row.first_name,
        last_name: row.last_name,
        avatar_url: row.avatar_url,
        tier: row.subscription_tier ?? "free",
      };
    });

  // Plaid cost aggregation. Billing is per Item per product; account types
  // gate which products an Item is eligible for.
  const plaidCostByUser = new Map<string, number>();
  let totalPlaidCost = 0;
  let totalPlaidItems = 0;
  let totalAccounts = 0;
  for (const item of (plaidItems ?? []) as PlaidItemRow[]) {
    const accountTypes = accountTypesByItemId.get(item.item_id) ?? [];
    const itemCost = estimateItemMonthlyCost(item, accountTypes);
    totalPlaidCost += itemCost;
    totalPlaidItems += 1;
    totalAccounts += accountTypes.length;
    plaidCostByUser.set(
      item.user_id,
      (plaidCostByUser.get(item.user_id) ?? 0) + itemCost,
    );
  }

  const topPlaidCostUsers = [...plaidCostByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, cost]) => {
      const auth = authById.get(userId);
      const p = profileById.get(userId);
      return {
        id: userId,
        email: auth?.email ?? null,
        first_name: p?.first_name ?? null,
        last_name: p?.last_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        cost,
      };
    });

  const totalUsers = userCount ?? 0;
  const proShare = totalUsers > 0 ? Math.round(((proCount ?? 0) / totalUsers) * 100) : 0;

  const growth30 = signupsLast30 ?? 0;
  const growthPrev = signupsPrev30 ?? 0;
  const growthDelta =
    growthPrev === 0
      ? growth30 > 0
        ? 100
        : 0
      : Math.round(((growth30 - growthPrev) / growthPrev) * 100);

  const onlineNow = recentlyOnline.filter((u) => presence(u.last_active_at) === "online").length;

  return (
    <>
      <AdminPageHeader title="Overview" subtitle="Internal state at a glance." />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-8 mb-16">
        <Stat
          label="Users"
          value={totalUsers}
          sub={
            <>
              <DeltaPill value={growthDelta} /> <span className="ml-1">vs. prev 30d</span>
            </>
          }
        />
        <Stat
          label="Pro"
          value={proCount ?? 0}
          sub={
            <span className="text-[var(--color-muted)]/80 tabular-nums">
              {proShare}% of users
            </span>
          }
        />
        <Stat
          label="Active · 7d"
          value={activeLast7 ?? 0}
          sub={
            <span className="text-[var(--color-muted)]/80 tabular-nums">
              {onlineNow > 0 ? `${onlineNow} online now` : "used the app recently"}
            </span>
          }
        />
        <Stat
          label="Plaid · est."
          value={`${formatUsd(totalPlaidCost)}`}
          sub={
            <span className="text-[var(--color-muted)]/80 tabular-nums">
              {totalAccounts} account{totalAccounts === 1 ? "" : "s"} ·{" "}
              {totalPlaidItems} item{totalPlaidItems === 1 ? "" : "s"} · /mo
            </span>
          }
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-12 gap-y-12">
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60">
              Recently online
            </h2>
            <Link
              href="/users"
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)] transition-colors"
            >
              All users ›
            </Link>
          </div>
          <ul className="divide-y divide-[var(--color-fg)]/[0.06] border-t border-b border-[var(--color-fg)]/[0.06]">
            {recentlyOnline.length === 0 ? (
              <li className="py-4 text-sm text-[var(--color-muted)]">
                No active users yet.
              </li>
            ) : (
              recentlyOnline.map((u) => {
                const p = presence(u.last_active_at);
                return (
                  <li key={u.id}>
                    <div className="flex items-center gap-3 py-3.5">
                      <Avatar
                        url={u.avatar_url}
                        initials={initials(u.first_name, u.last_name, u.email)}
                        presence={p}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--color-fg)] truncate">
                            {fullName(u.first_name, u.last_name, u.email)}
                          </span>
                          {u.tier === "pro" && (
                            <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent)] font-semibold">
                              pro
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-muted)] truncate leading-tight mt-0.5">
                          {u.email ?? "—"}
                        </div>
                      </div>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span
                          className={
                            p === "online"
                              ? "text-xs font-medium text-[var(--color-success)]"
                              : "text-xs text-[var(--color-muted)] tabular-nums"
                          }
                        >
                          {p === "online" ? "online" : formatRelative(u.last_active_at)}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section>
          <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-3">
            Tier breakdown
          </h2>
          <TierBar pro={proCount ?? 0} total={totalUsers} />

          <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]/60 mb-3 mt-10">
            Top Plaid cost
          </h2>
          {topPlaidCostUsers.length === 0 ? (
            <div className="border-t border-b border-[var(--color-fg)]/[0.06] py-3 text-xs text-[var(--color-muted)]">
              No Plaid items connected.
            </div>
          ) : (
            <ul className="divide-y divide-[var(--color-fg)]/[0.06] border-t border-b border-[var(--color-fg)]/[0.06]">
              {topPlaidCostUsers.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <Avatar
                    url={u.avatar_url}
                    initials={initials(u.first_name, u.last_name, u.email)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-[var(--color-fg)] truncate leading-tight">
                      {fullName(u.first_name, u.last_name, u.email)}
                    </div>
                    <div className="text-[11px] text-[var(--color-muted)] truncate leading-tight">
                      {u.email ?? "—"}
                    </div>
                  </div>
                  <span className="text-xs tabular-nums text-[var(--color-fg)] flex-shrink-0">
                    {formatUsd(u.cost)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: ReactNode;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]/70">
        {label}
      </div>
      <div className="mt-1 text-3xl font-medium tabular-nums text-[var(--color-fg)]">
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-[11px] text-[var(--color-muted)] flex items-center">
          {sub}
        </div>
      )}
    </div>
  );
}

function DeltaPill({ value }: { value: number }) {
  if (value === 0) {
    return <span className="text-[var(--color-muted)]/80 tabular-nums">flat</span>;
  }
  const positive = value > 0;
  return (
    <span
      className={
        positive
          ? "text-[var(--color-success)] font-medium tabular-nums"
          : "text-[var(--color-danger)] font-medium tabular-nums"
      }
    >
      {positive ? "+" : ""}
      {value}%
    </span>
  );
}

function Avatar({
  url,
  initials,
  presence: p,
}: {
  url: string | null;
  initials: string;
  presence?: Presence;
}) {
  return (
    <div className="relative h-9 w-9 flex-shrink-0 rounded-full bg-[var(--color-accent)] flex items-center justify-center overflow-hidden text-[11px] font-semibold text-[var(--color-on-accent)]">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
      {p === "online" && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[var(--color-success)] ring-2 ring-[var(--color-content-bg)]"
        />
      )}
      {p === "recent" && (
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-[#d97706] ring-2 ring-[var(--color-content-bg)]"
        />
      )}
    </div>
  );
}

function TierBar({ pro, total }: { pro: number; total: number }) {
  const proShare = total > 0 ? (pro / total) * 100 : 0;
  const freeShare = 100 - proShare;
  const free = Math.max(0, total - pro);

  return (
    <div>
      <div className="flex items-baseline justify-between text-xs mb-2">
        <span className="text-[var(--color-muted)]">Free</span>
        <span className="tabular-nums text-[var(--color-fg)]">{free}</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-[var(--color-fg)]/[0.06]">
        <div
          className="bg-[var(--color-accent)]"
          style={{ width: `${proShare}%` }}
        />
        <div
          className="bg-[var(--color-fg)]/20"
          style={{ width: `${freeShare}%` }}
        />
      </div>
      <div className="flex items-baseline justify-between text-xs mt-2">
        <span className="text-[var(--color-accent)] font-medium">Pro</span>
        <span className="tabular-nums text-[var(--color-fg)]">{pro}</span>
      </div>
    </div>
  );
}
