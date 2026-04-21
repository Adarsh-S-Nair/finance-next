import { NextRequest, NextResponse } from "next/server";
import { requireVerifiedUserId } from "../../../../../../lib/api/auth";
import { isCallerAdmin } from "../../../../../../lib/api/admin";
import {
  grantUserPro,
  revokeUserPro,
} from "../../../../../../lib/accountDeletion/subscriptionActions";

type RouteContext = { params: Promise<{ id: string }> };
type Action = "grant_pro" | "revoke_pro";

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const callerId = requireVerifiedUserId(req);
    const { id: targetUserId } = await context.params;

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    if (!(await isCallerAdmin(callerId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json().catch(() => null)) as { action?: Action } | null;
    if (!body?.action || (body.action !== "grant_pro" && body.action !== "revoke_pro")) {
      return NextResponse.json(
        { error: "Missing or invalid `action` (expected grant_pro | revoke_pro)" },
        { status: 400 },
      );
    }

    const result =
      body.action === "grant_pro"
        ? await grantUserPro(targetUserId)
        : await revokeUserPro(targetUserId);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    console.error("[admin subscription PATCH] unexpected error:", e);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}
