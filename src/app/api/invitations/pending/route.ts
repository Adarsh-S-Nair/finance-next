import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../lib/api/auth";

type HouseholdRow = {
  id: string;
  name: string;
  color: string;
};

type ProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

/**
 * Pending targeted invitations addressed to the caller. Used by the
 * AlertsIcon dropdown to surface "X invited you to Y household".
 */
export async function GET(request: NextRequest) {
  try {
    const userId = requireVerifiedUserId(request);
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const { data: invites, error: invitesErr } = await supabaseAdmin
      .from("household_invitations")
      .select("id, household_id, created_by, created_at, expires_at")
      .eq("invited_user_id", userId)
      .is("used_at", null)
      .is("dismissed_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    if (invitesErr) {
      console.error("[invitations] pending error", invitesErr);
      return NextResponse.json({ error: "Failed to load invitations" }, { status: 500 });
    }

    const rows = (invites ?? []) as Array<{
      id: string;
      household_id: string;
      created_by: string;
      created_at: string;
      expires_at: string;
    }>;
    if (rows.length === 0) return NextResponse.json({ invitations: [] });

    const householdIds = Array.from(new Set(rows.map((r) => r.household_id)));
    const inviterIds = Array.from(new Set(rows.map((r) => r.created_by)));

    const [{ data: households }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("households")
        .select("id, name, color")
        .in("id", householdIds),
      supabaseAdmin
        .from("user_profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", inviterIds),
    ]);

    const householdsById = new Map<string, HouseholdRow>(
      ((households ?? []) as HouseholdRow[]).map((h) => [h.id, h]),
    );
    const profileById = new Map<string, ProfileRow>(
      ((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]),
    );

    return NextResponse.json({
      invitations: rows.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        expires_at: r.expires_at,
        household: householdsById.get(r.household_id) ?? null,
        invited_by: profileById.get(r.created_by) ?? null,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[invitations] pending error", error);
    return NextResponse.json({ error: "Failed to load invitations" }, { status: 500 });
  }
}
