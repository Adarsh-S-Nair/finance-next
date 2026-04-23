import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../../../lib/supabase/admin";
import { withAuth } from "../../../../../../lib/api/withAuth";
import { getMembershipRole } from "../../../../../../lib/households/server";

type UserLookupRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

/**
 * Look up a user by exact email so the inviter can see the person's name
 * before they send the invite. Only household owners (the role that can
 * invite) can call this. Requires an exact case-insensitive email match —
 * no fuzzy matching — to limit account-enumeration surface area.
 */
export const GET = withAuth<{ id: string }>("households:invitations:lookup", async (request, userId, { params }) => {
    const { id: householdId } = await params;
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const role = await getMembershipRole(householdId, userId);
    if (role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const email = (new URL(request.url).searchParams.get("email") || "").trim();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ user: null });
    }

    const { data, error } = await supabaseAdmin.rpc("find_user_by_email", {
      p_email: email,
    });
    if (error) {
      console.error("[households] lookup RPC error", error);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }

    const rows = (data ?? []) as UserLookupRow[];
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ user: null });
    }

    // Don't echo the inviter themselves as a valid target.
    if (user.id === userId) {
      return NextResponse.json({ user: null, self: true });
    }

    // Already a member — surface that so the UI can say so.
    const existingRole = await getMembershipRole(householdId, user.id);
    if (existingRole) {
      return NextResponse.json({
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url,
        },
        already_member: true,
      });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        avatar_url: user.avatar_url,
      },
    });
});
