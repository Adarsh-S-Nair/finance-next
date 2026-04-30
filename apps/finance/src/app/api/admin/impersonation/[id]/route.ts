import { NextResponse } from "next/server";
import { withAuth } from "../../../../../lib/api/withAuth";
import { isCallerAdmin } from "../../../../../lib/api/admin";
import { supabaseAdmin } from "../../../../../lib/supabase/admin";

/**
 * Admin cancels their own pending request, or revokes their own active
 * grant. We don't let admins act on grants they didn't create — the
 * `requester_id` check is the access boundary. Targets revoke through a
 * separate user-facing endpoint, not this one.
 */
export const DELETE = withAuth<{ id: string }>(
  "admin:impersonation:cancel",
  async (_req, callerId, { params }) => {
    if (!(await isCallerAdmin(callerId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: grantId } = await params;
    if (!grantId) {
      return NextResponse.json({ error: "Missing grant id" }, { status: 400 });
    }

    const { data: grant, error: fetchErr } = await supabaseAdmin
      .from("impersonation_grants")
      .select("id, status, requester_id")
      .eq("id", grantId)
      .single();

    if (fetchErr || !grant) {
      return NextResponse.json({ error: "Grant not found" }, { status: 404 });
    }
    if (grant.requester_id !== callerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (grant.status === "denied" || grant.status === "expired" || grant.status === "revoked") {
      return NextResponse.json({ error: `Grant already ${grant.status}` }, { status: 400 });
    }

    // We use "revoked" as the terminal state for both target and admin
    // cancellations — the audit trail (who decided_at when) and the
    // session log distinguish who took the action if it ever matters.
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("impersonation_grants")
      .update({ status: "revoked", decided_at: new Date().toISOString() })
      .eq("id", grantId)
      .select("id, status, expires_at, decided_at, duration_seconds, requested_at, reason")
      .single();

    if (updErr || !updated) {
      console.error("[admin:impersonation:cancel] update failed", updErr);
      return NextResponse.json({ error: "Could not cancel grant" }, { status: 500 });
    }

    return NextResponse.json({ grant: updated });
  },
);
