import { createAdminClient } from "@/lib/supabase/server";
import AdminShell from "@/components/AdminShell";

export const dynamic = "force-dynamic";

type Profile = {
  id: string;
  first_name: string | null;
  last_name: string | null;
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

function fullName(p: Profile | undefined): string {
  if (!p) return "—";
  const parts = [p.first_name, p.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

export default async function UsersPage() {
  const admin = createAdminClient();

  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("id, first_name, last_name, subscription_tier, subscription_status");

  const profileMap = new Map<string, Profile>();
  (profiles ?? []).forEach((p) => profileMap.set(p.id, p as Profile));

  const users = (authData?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at ?? null,
    last_sign_in_at: u.last_sign_in_at ?? null,
  }));

  return (
    <AdminShell>
      <header className="mb-10">
        <h1 className="text-2xl font-medium tracking-tight text-[var(--color-fg)]">
          Users
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {users.length} total
        </p>
      </header>

      {authErr ? (
        <p className="text-sm text-[var(--color-danger)]">
          Failed to load users: {authErr.message}
        </p>
      ) : users.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No users yet.</p>
      ) : (
        <div className="border-t border-[var(--color-fg)]/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.08em] text-[var(--color-muted)]/60">
                <th className="text-left font-medium py-3 pr-4">Email</th>
                <th className="text-left font-medium py-3 pr-4">Name</th>
                <th className="text-left font-medium py-3 pr-4">Tier</th>
                <th className="text-left font-medium py-3 pr-4">Joined</th>
                <th className="text-left font-medium py-3">Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const p = profileMap.get(u.id);
                const tier = p?.subscription_tier ?? "free";
                return (
                  <tr
                    key={u.id}
                    className="border-t border-[var(--color-fg)]/[0.06] hover:bg-[var(--color-fg)]/[0.03] transition-colors"
                  >
                    <td className="py-3 pr-4 text-[var(--color-fg)]">
                      {u.email ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-muted)]">
                      {fullName(p)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          tier === "pro"
                            ? "text-[var(--color-accent)] font-medium"
                            : "text-[var(--color-muted)]"
                        }
                      >
                        {tier}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-muted)]">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="py-3 text-[var(--color-muted)]">
                      {formatDate(u.last_sign_in_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
