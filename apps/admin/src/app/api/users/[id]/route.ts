import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/auth/admin";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Resolve the finance app's origin. In prod we default to zervo.app; in
 * local dev the caller can override with FINANCE_API_URL=http://localhost:3000.
 * The delete flow that lives in finance owns the Plaid + Stripe SDKs, so
 * admin never needs those deps — it just proxies with the admin's Bearer
 * token and lets finance execute the teardown.
 */
function getFinanceApiUrl(): string {
  return process.env.FINANCE_API_URL || "https://zervo.app";
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id: targetUserId } = await context.params;
    if (!targetUserId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user || !session.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAllowedAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (session.user.id === targetUserId) {
      return NextResponse.json(
        { error: "You can't delete your own admin account from here." },
        { status: 400 },
      );
    }

    const financeUrl = `${getFinanceApiUrl()}/api/admin/users/${encodeURIComponent(targetUserId)}`;
    const res = await fetch(financeUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: body?.error || "Delete failed at finance API" },
        { status: res.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[admin users proxy] unexpected error:", err?.message ?? e);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
