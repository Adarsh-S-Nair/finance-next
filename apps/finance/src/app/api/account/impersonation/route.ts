import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../lib/supabase/admin";

/**
 * The current user lists impersonation grants targeting them — pending
 * requests that need a decision and active grants they may want to
 * revoke. The settings page also uses this to show full history.
 */
export const GET = withAuth("account:impersonation:list", async (req: NextRequest, callerId) => {
  const includeAll = req.nextUrl.searchParams.get("all") === "1";

  let query = supabaseAdmin
    .from("impersonation_grants")
    .select("id, status, expires_at, decided_at, duration_seconds, requested_at, reason, requester_id")
    .eq("target_user_id", callerId)
    .order("requested_at", { ascending: false });

  if (!includeAll) {
    query = query.in("status", ["pending", "approved"]).limit(10);
  } else {
    query = query.limit(50);
  }

  const { data: grants, error } = await query;
  if (error) {
    console.error("[account:impersonation:list] query failed", error);
    return NextResponse.json({ error: "Could not load grants" }, { status: 500 });
  }

  // Hydrate requester profile so the notification can say "Adarsh Nair (Admin)…".
  // Do this server-side because clients can't read auth.users for non-self,
  // and user_profiles is RLS-restricted to the caller's own row.
  const requesterIds = Array.from(new Set((grants ?? []).map((g) => g.requester_id)));
  const requesterById: Record<
    string,
    {
      email: string | null;
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    }
  > = {};
  if (requesterIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("user_profiles")
      .select("id, first_name, last_name, avatar_url")
      .in("id", requesterIds);
    const profileById = new Map<
      string,
      { first_name: string | null; last_name: string | null; avatar_url: string | null }
    >();
    for (const p of profiles ?? []) {
      profileById.set(p.id, {
        first_name: p.first_name,
        last_name: p.last_name,
        avatar_url: p.avatar_url,
      });
    }
    for (const id of requesterIds) {
      const auth = await supabaseAdmin.auth.admin.getUserById(id);
      const profile = profileById.get(id);
      requesterById[id] = {
        email: auth.data?.user?.email ?? null,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
      };
    }
  }

  const enriched = (grants ?? []).map((g) => {
    const r = requesterById[g.requester_id];
    return {
      ...g,
      requester_email: r?.email ?? null,
      requester_first_name: r?.first_name ?? null,
      requester_last_name: r?.last_name ?? null,
      requester_avatar_url: r?.avatar_url ?? null,
    };
  });

  return NextResponse.json({ grants: enriched });
});
