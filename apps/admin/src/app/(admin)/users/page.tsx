import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
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

function fullName(p: Profile | undefined, email: string | null): string {
  const parts = [p?.first_name, p?.last_name].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ");
  return email?.split("@")[0] ?? "—";
}

function initials(p: Profile | undefined, email: string | null): string {
  if (p?.first_name && p?.last_name) return `${p.first_name[0]}${p.last_name[0]}`.toUpperCase();
  if (p?.first_name) return p.first_name[0]!.toUpperCase();
  if (email) return email[0]!.toUpperCase();
  return "?";
}

export default async function UsersPage() {
  const admin = createAdminClient();

  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  const { data: profiles } = await admin
    .from("user_profiles")
    .select(
      "id, first_name, last_name, avatar_url, subscription_tier, subscription_status",
    );

  const profileMap = new Map<string, Profile>();
  for (const row of (profiles ?? []) as Profile[]) {
    profileMap.set(row.id, row);
  }

  const users = (authData?.users ?? [])
    .map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }))
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

  const proCount = users.filter(
    (u) => profileMap.get(u.id)?.subscription_tier === "pro",
  ).length;

  return (
    <>
      <header className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
            Users
          </h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {users.length} total
            <span className="mx-2 text-[var(--color-muted)]/40">·</span>
            {proCount} pro
          </p>
        </div>
      </header>

      {authErr ? (
        <p className="text-sm text-[var(--color-danger)]">
          Failed to load users: {authErr.message}
        </p>
      ) : users.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No users yet.</p>
      ) : (
        <ul className="border-t border-b border-[var(--color-fg)]/[0.06] divide-y divide-[var(--color-fg)]/[0.06]">
          {users.map((u) => {
            const p = profileMap.get(u.id);
            const tier = p?.subscription_tier ?? "free";
            const status = p?.subscription_status ?? null;
            const isPro = tier === "pro";
            return (
              <li
                key={u.id}
                className="group relative flex items-center gap-4 py-4 px-3 -mx-3 rounded-md transition-colors hover:bg-[var(--color-fg)]/[0.04]"
              >
                <div className="relative h-10 w-10 flex-shrink-0 rounded-full bg-[var(--color-accent)] flex items-center justify-center overflow-hidden text-xs font-semibold text-[var(--color-on-accent)]">
                  {p?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatar_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{initials(p, u.email)}</span>
                  )}
                  {isPro && (
                    <span
                      className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-content-bg)]"
                      aria-hidden
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-fg)] truncate">
                      {fullName(p, u.email)}
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
                  <div className="mt-0.5 text-xs text-[var(--color-muted)] truncate">
                    {u.email ?? "—"}
                  </div>
                  <div className="mt-1.5 flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px] text-[var(--color-muted)]/80">
                    <Meta label="Joined" value={formatDate(u.created_at)} />
                    <span className="text-[var(--color-muted)]/30">·</span>
                    <Meta label="Last seen" value={formatRelative(u.last_sign_in_at)} />
                    <span className="text-[var(--color-muted)]/30">·</span>
                    <Meta label="ID" value={u.id.slice(0, 8)} mono />
                  </div>
                </div>

                <span className="text-[var(--color-muted)]/40 text-lg flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                  ›
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-[var(--color-muted)]/50">{label}</span>
      <span className={mono ? "font-mono text-[var(--color-muted)]" : "text-[var(--color-muted)]"}>
        {value}
      </span>
    </span>
  );
}
