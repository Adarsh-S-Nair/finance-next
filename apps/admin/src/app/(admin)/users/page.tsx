import { createAdminClient, createClient } from "@/lib/supabase/server";
import AdminPageHeader from "@/components/AdminPageHeader";
import {
  estimateItemMonthlyCost,
  type PlaidItemRow,
} from "@/lib/plaidPricing";
import { costForUsage } from "@/lib/agentPricing";
import UsersClient, {
  type AdminUserRow,
  type AgentUsageTotal,
  type ImpersonationGrant,
  type PlaidItemWithCost,
} from "./UsersClient";

export const dynamic = "force-dynamic";

type AgentUsageTotalRow = {
  user_id: string;
  model: string;
  input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  output_tokens: number;
  turns: number;
  first_used_at: string;
  last_used_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  subscription_tier: string | null;
  subscription_status: string | null;
  last_active_at: string | null;
};

type ImpersonationGrantRow = {
  id: string;
  status: string;
  expires_at: string | null;
  decided_at: string | null;
  duration_seconds: number;
  requested_at: string;
  reason: string | null;
  target_user_id: string;
};

export default async function UsersPage() {
  const admin = createAdminClient();

  // Identify the calling admin so we can preload their impersonation
  // grants alongside the user list. Drawer opens are instant when the
  // current state ships in the initial render — no per-open fetch.
  const supabase = await createClient();
  const { data: callerData } = await supabase.auth.getUser();
  const callerId = callerData?.user?.id ?? null;

  const [
    { data: authData, error: authErr },
    { data: profiles },
    { data: plaidItems },
    { data: accounts },
    { data: impersonationGrants },
    { data: agentTotals },
  ] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    admin
      .from("user_profiles")
      .select(
        "id, first_name, last_name, avatar_url, subscription_tier, subscription_status, last_active_at",
      ),
    admin
      .from("plaid_items")
      .select(
        "id, user_id, item_id, products, recurring_ready, sync_status, last_error, created_at",
      ),
    admin.from("accounts").select("item_id, type"),
    callerId
      ? admin
          .from("impersonation_grants")
          .select(
            "id, status, expires_at, decided_at, duration_seconds, requested_at, reason, target_user_id",
          )
          .eq("requester_id", callerId)
          .order("requested_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [] as ImpersonationGrantRow[] }),
    // Per-(user, model) lifetime token totals. Rows survive
    // conversation/message deletion via the trigger on
    // user_agent_usage so this is the right surface for "how much
    // has this user cost us in total".
    admin
      .from("user_agent_usage_totals")
      .select(
        "user_id, model, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, turns, first_used_at, last_used_at",
      ),
  ]);

  const profileMap = new Map<string, ProfileRow>();
  for (const row of (profiles ?? []) as ProfileRow[]) {
    profileMap.set(row.id, row);
  }

  // Group account types by item_id. Plaid bills per Item per product, but
  // only for products the Item is actually eligible to use — so we need
  // the account *types* per item to gate eligibility.
  const accountTypesByItemId = new Map<string, (string | null)[]>();
  for (const row of (accounts ?? []) as { item_id: string; type: string | null }[]) {
    const list = accountTypesByItemId.get(row.item_id) ?? [];
    list.push(row.type);
    accountTypesByItemId.set(row.item_id, list);
  }

  const grantsByTarget = new Map<string, ImpersonationGrant[]>();
  for (const row of (impersonationGrants ?? []) as ImpersonationGrantRow[]) {
    const list = grantsByTarget.get(row.target_user_id) ?? [];
    list.push({
      id: row.id,
      status: row.status,
      expires_at: row.expires_at,
      decided_at: row.decided_at,
      duration_seconds: row.duration_seconds,
      requested_at: row.requested_at,
      reason: row.reason,
    });
    grantsByTarget.set(row.target_user_id, list);
  }

  // Group agent usage totals by user, summing cost across models.
  // Each (user, model) row carries lifetime counters; cost is computed
  // here so admin can see $/user without round-tripping the rates.
  const agentByUser = new Map<
    string,
    { totals: AgentUsageTotal[]; cost: number; turns: number; lastUsedAt: string | null }
  >();
  for (const row of (agentTotals ?? []) as AgentUsageTotalRow[]) {
    const cost = costForUsage(row.model, {
      input_tokens: row.input_tokens,
      cache_read_tokens: row.cache_read_tokens,
      cache_write_tokens: row.cache_write_tokens,
      output_tokens: row.output_tokens,
    });
    const total: AgentUsageTotal = {
      model: row.model,
      input_tokens: row.input_tokens,
      cache_read_tokens: row.cache_read_tokens,
      cache_write_tokens: row.cache_write_tokens,
      output_tokens: row.output_tokens,
      turns: row.turns,
      first_used_at: row.first_used_at,
      last_used_at: row.last_used_at,
      cost,
    };
    const bucket = agentByUser.get(row.user_id) ?? {
      totals: [],
      cost: 0,
      turns: 0,
      lastUsedAt: null as string | null,
    };
    bucket.totals.push(total);
    bucket.cost += cost;
    bucket.turns += row.turns;
    if (!bucket.lastUsedAt || row.last_used_at > bucket.lastUsedAt) {
      bucket.lastUsedAt = row.last_used_at;
    }
    agentByUser.set(row.user_id, bucket);
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
      const agent = agentByUser.get(u.id) ?? null;
      return {
        id: u.id,
        email: u.email ?? null,
        created_at: u.created_at ?? null,
        last_active_at: p?.last_active_at ?? u.last_sign_in_at ?? null,
        first_name: p?.first_name ?? null,
        last_name: p?.last_name ?? null,
        avatar_url: p?.avatar_url ?? null,
        subscription_tier: p?.subscription_tier ?? null,
        subscription_status: p?.subscription_status ?? null,
        plaid_items: items,
        plaid_monthly_cost: monthlyCost,
        impersonation_grants: grantsByTarget.get(u.id) ?? [],
        agent_usage_totals: agent?.totals ?? [],
        agent_total_cost: agent?.cost ?? 0,
        agent_total_turns: agent?.turns ?? 0,
        agent_last_used_at: agent?.lastUsedAt ?? null,
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
