import { createAdminClient } from "@/lib/supabase/server";
import AdminPageHeader from "@/components/AdminPageHeader";
import {
  estimateItemMonthlyCost,
  type PlaidItemRow,
} from "@/lib/plaidPricing";
import UsersClient, {
  type AdminUserRow,
  type PlaidItemWithCost,
} from "./UsersClient";

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

  const [
    { data: authData, error: authErr },
    { data: profiles },
    { data: plaidItems },
    { data: accounts },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin
      .from("user_profiles")
      .select(
        "id, first_name, last_name, avatar_url, subscription_tier, subscription_status",
      ),
    admin
      .from("plaid_items")
      .select(
        "id, user_id, item_id, products, recurring_ready, sync_status, last_error, created_at",
      ),
    admin.from("accounts").select("item_id, type"),
  ]);

  const profileMap = new Map<string, ProfileRow>();
  for (const row of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(row.id, row);
  }

  // Group account types by item_id. Plaid bills per connected account per
  // product, but only for accounts the product actually applies to — so we
  // need the account *types* per item, not just the count.
  const accountTypesByItemId = new Map<string, (string | null)[]>();
  for (const row of (accounts ?? []) as { item_id: string; type: string | null }[]) {
    const list = accountTypesByItemId.get(row.item_id) ?? [];
    list.push(row.type);
    accountTypesByItemId.set(row.item_id, list);
  }

  const itemsByUser = new Map<string, PlaidItemWithCost[]>();
  for (const row of (plaidItems ?? []) as PlaidItemRow[]) {
    const accountTypes = accountTypesByItemId.get(row.item_id) ?? [];
    const monthlyCost = estimateItemMonthlyCost(row, accountTypes);
    const enriched: PlaidItemWithCost = {
      ...row,
      account_types: accountTypes,
      account_count: accountTypes.length,
      monthly_cost: monthlyCost,
    };
    const list = itemsByUser.get(row.user_id) ?? [];
    list.push(enriched);
    itemsByUser.set(row.user_id, list);
  }

  const users: AdminUserRow[] = (authData?.users ?? [])
    .map((u) => {
      const p = profileMap.get(u.id);
      const items = itemsByUser.get(u.id) ?? [];
      const monthlyCost = items.reduce((sum, it) => sum + it.monthly_cost, 0);
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
        plaid_items: items,
        plaid_monthly_cost: monthlyCost,
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
