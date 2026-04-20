import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../../lib/api/auth";
import { getMembershipRole } from "../../../../../lib/households/server";

type AccountRow = {
  id: string;
  user_id: string;
  item_id: string;
  account_id: string;
  name: string;
  mask: string | null;
  type: string | null;
  subtype: string | null;
  balances: Record<string, unknown> | null;
  institution_id: string | null;
  institutions?: unknown;
  plaid_items?: unknown;
  created_at: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Household-scoped accounts: returns every Plaid-linked account owned by
 * any member of the household, annotated with the owning member's profile
 * so the UI can attribute each account. Per-account sharing opt-in lands
 * in a follow-up — for now every member account is visible to every member.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const userId = requireVerifiedUserId(request);
    const { id: householdId } = await context.params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const role = await getMembershipRole(householdId, userId);
    if (!role) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data: members, error: membersErr } = await supabaseAdmin
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId);
    if (membersErr) {
      console.error("[households] accounts member list error", membersErr);
      return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
    }

    const memberIds = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
    if (memberIds.length === 0) {
      return NextResponse.json({ accounts: [], members: [] });
    }

    const [{ data: accounts, error: accountsErr }, { data: profiles, error: profilesErr }] =
      await Promise.all([
        supabaseAdmin
          .from("accounts")
          .select(
            `*, institutions (id, institution_id, name, logo, primary_color, url), plaid_items (id, item_id, access_token)`,
          )
          .in("user_id", memberIds)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("user_profiles")
          .select("id, first_name, last_name, avatar_url")
          .in("id", memberIds),
      ]);
    if (accountsErr) {
      console.error("[households] accounts fetch error", accountsErr);
      return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
    }
    if (profilesErr) {
      console.error("[households] accounts profile fetch error", profilesErr);
    }

    const profileById = new Map<string, ProfileRow>(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    );

    const annotated = ((accounts ?? []) as AccountRow[]).map((a) => {
      const profile = profileById.get(a.user_id);
      return {
        ...a,
        owner: profile
          ? {
              user_id: a.user_id,
              first_name: profile.first_name,
              last_name: profile.last_name,
              avatar_url: profile.avatar_url,
            }
          : { user_id: a.user_id, first_name: null, last_name: null, avatar_url: null },
      };
    });

    return NextResponse.json({
      accounts: annotated,
      members: (profiles ?? []) as ProfileRow[],
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] accounts error", error);
    return NextResponse.json({ error: "Failed to load accounts" }, { status: 500 });
  }
}
