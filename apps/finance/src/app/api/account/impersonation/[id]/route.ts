import { NextResponse, type NextRequest } from "next/server";
import { withAuth } from "../../../../../lib/api/withAuth";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

/**
 * Target user approves, denies, or revokes a grant aimed at them. State
 * machine:
 *   pending  → approved (sets expires_at = now + duration)
 *   pending  → denied
 *   approved → revoked
 * Anything else is rejected — re-requesting goes through the admin path.
 */
export const PATCH = withAuth<{ id: string }>(
  "account:impersonation:decide",
  async (req: NextRequest, callerId, { params }) => {
    const { id: grantId } = await params;
    if (!grantId) {
      return NextResponse.json({ error: "Missing grant id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action;
    if (action !== "approve" && action !== "deny" && action !== "revoke") {
      return NextResponse.json(
        { error: "action must be approve | deny | revoke" },
        { status: 400 },
      );
    }

    const { data: grant, error: fetchErr } = await supabaseAdmin
      .from("impersonation_grants")
      .select("id, status, target_user_id, duration_seconds")
      .eq("id", grantId)
      .single();

    if (fetchErr || !grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }
    if (grant.target_user_id !== callerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "approve") {
      if (grant.status !== "pending") {
        return NextResponse.json(
          { error: `Cannot approve a ${grant.status} grant` },
          { status: 400 },
        );
      }
      const now = new Date();
      // duration_seconds === 0 means indefinite — leave expires_at null so
      // the grant runs until revoked. Every guard treats null as "still
      // valid" provided status is approved.
      const expires =
        grant.duration_seconds > 0
          ? new Date(now.getTime() + grant.duration_seconds * 1000).toISOString()
          : null;
      const { data: updated, error } = await supabaseAdmin
        .from("impersonation_grants")
        .update({
          status: "approved",
          decided_at: now.toISOString(),
          expires_at: expires,
        })
        .eq("id", grantId)
        .select(
          "id, status, expires_at, decided_at, duration_seconds, requested_at, reason, requester_id",
        )
        .single();
      if (error || !updated) {
        console.error("[account:impersonation:decide] approve failed", error);
        return NextResponse.json({ error: "Could not approve" }, { status: 500 });
      }
      return NextResponse.json({ grant: updated });
    }

    if (action === "deny") {
      if (grant.status !== "pending") {
        return NextResponse.json(
          { error: `Cannot deny a ${grant.status} grant` },
          { status: 400 },
        );
      }
      const { data: updated, error } = await supabaseAdmin
        .from("impersonation_grants")
        .update({ status: "denied", decided_at: new Date().toISOString() })
        .eq("id", grantId)
        .select(
          "id, status, expires_at, decided_at, duration_seconds, requested_at, reason, requester_id",
        )
        .single();
      if (error || !updated) {
        console.error("[account:impersonation:decide] deny failed", error);
        return NextResponse.json({ error: "Could not deny" }, { status: 500 });
      }
      return NextResponse.json({ grant: updated });
    }

    // revoke
    if (grant.status !== "approved") {
      return NextResponse.json(
        { error: `Cannot revoke a ${grant.status} grant` },
        { status: 400 },
      );
    }
    const { data: updated, error } = await supabaseAdmin
      .from("impersonation_grants")
      .update({ status: "revoked", decided_at: new Date().toISOString() })
      .eq("id", grantId)
      .select(
        "id, status, expires_at, decided_at, duration_seconds, requested_at, reason, requester_id",
      )
      .single();
    if (error || !updated) {
      console.error("[account:impersonation:decide] revoke failed", error);
      return NextResponse.json({ error: "Could not revoke" }, { status: 500 });
    }
    return NextResponse.json({ grant: updated });
  },
);
