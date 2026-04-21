import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase/admin";
import { requireVerifiedUserId } from "../../../../lib/api/auth";

/**
 * Preview an invite code before redeeming. Lets the UI show "You've been
 * invited to <name> by <person>" before the user commits.
 */
export async function GET(request: NextRequest) {
  try {
    requireVerifiedUserId(request);
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const code = (new URL(request.url).searchParams.get("code") || "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("household_invitations")
      .select("household_id, expires_at, revoked_at, used_at, created_by")
      .eq("code", code)
      .maybeSingle();
    if (inviteErr) {
      console.error("[households] join preview error", inviteErr);
      return NextResponse.json({ error: "Failed to look up invite" }, { status: 500 });
    }
    if (!invite) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }
    const isStale =
      invite.revoked_at ||
      invite.used_at ||
      new Date(invite.expires_at).getTime() <= Date.now();
    if (isStale) {
      return NextResponse.json({ error: "Invite is no longer valid" }, { status: 410 });
    }

    const [{ data: household }, { data: inviter }, { count }] = await Promise.all([
      supabaseAdmin
        .from("households")
        .select("id, name, color")
        .eq("id", invite.household_id)
        .maybeSingle(),
      supabaseAdmin
        .from("user_profiles")
        .select("first_name, last_name")
        .eq("id", invite.created_by)
        .maybeSingle(),
      supabaseAdmin
        .from("household_members")
        .select("user_id", { count: "exact", head: true })
        .eq("household_id", invite.household_id),
    ]);
    if (!household) {
      return NextResponse.json({ error: "Household not found" }, { status: 404 });
    }

    return NextResponse.json({
      household: { id: household.id, name: household.name, member_count: count ?? 0 },
      invited_by: inviter
        ? { first_name: inviter.first_name, last_name: inviter.last_name }
        : null,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] join preview error", error);
    return NextResponse.json({ error: "Failed to look up invite" }, { status: 500 });
  }
}

/**
 * Redeem an invite code. The caller becomes a member of the referenced
 * household; the invite is marked used so it can't be replayed.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = requireVerifiedUserId(request);
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body?.code === "string" ? body.code : "";
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
    }

    const { data: invite, error: inviteErr } = await supabaseAdmin
      .from("household_invitations")
      .select("id, household_id, expires_at, revoked_at, used_at")
      .eq("code", code)
      .maybeSingle();
    if (inviteErr) {
      console.error("[households] join lookup error", inviteErr);
      return NextResponse.json({ error: "Failed to join household" }, { status: 500 });
    }
    if (!invite) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }
    if (invite.revoked_at) {
      return NextResponse.json({ error: "This invite has been revoked" }, { status: 410 });
    }
    if (invite.used_at) {
      return NextResponse.json({ error: "This invite has already been used" }, { status: 410 });
    }
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
    }

    // If the user is already a member, treat this as a no-op success so the
    // UI can still route them to the household page.
    const { data: existing, error: existingErr } = await supabaseAdmin
      .from("household_members")
      .select("household_id")
      .eq("household_id", invite.household_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (existingErr) {
      console.error("[households] join existing check error", existingErr);
      return NextResponse.json({ error: "Failed to join household" }, { status: 500 });
    }

    if (!existing) {
      const { error: insertErr } = await supabaseAdmin
        .from("household_members")
        .insert({
          household_id: invite.household_id,
          user_id: userId,
          role: "member",
        });
      if (insertErr) {
        console.error("[households] join insert error", insertErr);
        return NextResponse.json({ error: "Failed to join household" }, { status: 500 });
      }
    }

    // Mark the invite used. Single-use invites are easier to reason about;
    // owners can generate additional ones as needed.
    await supabaseAdmin
      .from("household_invitations")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("id", invite.id);

    return NextResponse.json({ household_id: invite.household_id });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[households] join error", error);
    return NextResponse.json({ error: "Failed to join household" }, { status: 500 });
  }
}
