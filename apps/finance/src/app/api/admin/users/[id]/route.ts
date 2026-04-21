import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedUserId } from "../../../../../lib/api/auth";
import { isCallerAdmin } from "../../../../../lib/api/admin";
import { deleteUserCompletely } from "../../../../../lib/accountDeletion/deleteUserCompletely";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Admin-only user deletion. Called by the admin subdomain's own proxy
 * route, which forwards the admin's Supabase access token. We funnel
 * through the same `deleteUserCompletely` helper as the user-facing
 * self-delete so Plaid /item/remove and Stripe cleanup always run.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const callerId = requireVerifiedUserId(req);
    const { id: targetUserId } = await context.params;

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
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[admin users DELETE] unexpected error:", e);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
