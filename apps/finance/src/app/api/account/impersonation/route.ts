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

  // Hydrate requester emails so the banner can say "Adarsh is requesting…".
  // Do this server-side because clients can't read auth.users for non-self.
  const requesterIds = Array.from(new Set((grants ?? []).map((g) => g.requester_id)));
  const requesterById: Record<string, { email: string | null }> = {};
  for (const id of requesterIds) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(id);
    requesterById[id] = { email: data?.user?.email ?? null };
  }

  const enriched = (grants ?? []).map((g) => ({
    ...g,
    requester_email: requesterById[g.requester_id]?.email ?? null,
  }));

  return NextResponse.json({ grants: enriched });
});
