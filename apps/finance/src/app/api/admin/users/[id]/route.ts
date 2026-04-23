import { NextResponse } from "next/server";
import { withAuth } from "../../../../../lib/api/withAuth";
import { isCallerAdmin } from "../../../../../lib/api/admin";
import { deleteUserCompletely } from "../../../../../lib/accountDeletion/deleteUserCompletely";

/**
 * Admin-only user deletion. Called by the admin subdomain's own proxy
 * route, which forwards the admin's Supabase access token. We funnel
 * through the same `deleteUserCompletely` helper as the user-facing
 * self-delete so Plaid /item/remove and Stripe cleanup always run.
 */
export const DELETE = withAuth<{ id: string }>("admin:users:delete", async (_req, callerId, { params }) => {
    const { id: targetUserId } = await params;

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const isAdmin = await isCallerAdmin(callerId);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Guard against self-delete via this path — admins should use their
    // own settings page. Keeps the action paths clearly distinct in logs.
    if (callerId === targetUserId) {
      return NextResponse.json(
        { error: "Use /api/account/delete to delete your own account" },
        { status: 400 },
      );
    }

    const result = await deleteUserCompletely(targetUserId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
});
