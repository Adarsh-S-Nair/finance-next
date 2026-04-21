import { createAdminClient } from "@/lib/supabase/server";
import AdminPageHeader from "@/components/AdminPageHeader";
import UsersClient, { type AdminUserRow } from "./UsersClient";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
};

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

  const profileMap = new Map<string, ProfileRow>();
  for (const row of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(row.id, row);
  }

  const users: AdminUserRow[] = (authData?.users ?? [])
    .map((u) => {
      const p = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at ?? null,
        last_sign_in_at: u.last_sign_in_at ?? null,
        first_name: p?.first_name ?? null,
        last_name: p?.last_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        subscription_tier: p?.subscription_tier ?? null,
        subscription_status: p?.subscription_status ?? null,
      };
    })
    .sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

  const proCount = users.filter((u) => u.subscription_tier === "pro").length;

  return (
    <>
      <AdminPageHeader
        title="Users"
        subtitle={
          <>
            {users.length} total
            <span className="mx-1.5 text-[var(--color-muted)]/40">·</span>
            {proCount} pro
          </>
        }
      />

      {authErr ? (
        <p className="text-sm text-[var(--color-danger)]">
          Failed to load users: {authErr.message}
        </p>
      ) : users.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">No users yet.</p>
      ) : (
        <UsersClient users={users} />
      )}
    </>
  );
}
