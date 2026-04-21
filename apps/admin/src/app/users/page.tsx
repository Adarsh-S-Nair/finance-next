import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/AdminShell";

export const dynamic = "force-dynamic";

type User = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
};

type Profile = {
  id: string;
  full_name: string | null;
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

export default async function UsersPage() {
  const supabase = await createClient();
  const {
    data: { user: me },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, subscription_tier, subscription_status");

  const profileMap = new Map<string, Profile>();
  (profiles ?? []).forEach((p) => profileMap.set(p.id, p as Profile));

  const users: User[] = (authData?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? null,
    created_at: u.created_at ?? null,
    last_sign_in_at: u.last_sign_in_at ?? null,
  }));

  return (
    <AdminShell email={me?.email} activePath="/users">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)]">
          Users
        </h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          {users.length} total
        </p>
      </header>

      {authErr ? (
        <div className="rounded-md border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 px-4 py-3 text-sm text-[var(--color-danger)]">
          Failed to load users: {authErr.message}
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <th className="px-5 py-3 text-left font-medium">Email</th>
                <th className="px-5 py-3 text-left font-medium">Name</th>
                <th className="px-5 py-3 text-left font-medium">Tier</th>
                <th className="px-5 py-3 text-left font-medium">Joined</th>
                <th className="px-5 py-3 text-left font-medium">Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const p = profileMap.get(u.id);
                const tier = p?.subscription_tier ?? "free";
                return (
                  <tr
                    key={u.id}
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-alt)]/60 transition-colors"
                  >
                    <td className="px-5 py-3 text-[var(--color-fg)]">
                      {u.email ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-muted)]">
                      {p?.full_name ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                          tier === "pro"
                            ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                            : "bg-[var(--color-surface-alt)] text-[var(--color-muted)]"
                        }`}
                      >
                        {tier}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--color-muted)]">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-5 py-3 text-[var(--color-muted)]">
                      {formatDate(u.last_sign_in_at)}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-[var(--color-muted)]"
                  >
                    No users yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}
