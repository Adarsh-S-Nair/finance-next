import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/auth/admin";

type RouteContext = { params: Promise<{ id: string }> };

function getFinanceApiUrl(): string {
  return process.env.FINANCE_API_URL || "https://zervo.app";
}

export async function PATCH(req: NextRequest, context: RouteContext) {
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

    const body = await req.text();
    const financeUrl = `${getFinanceApiUrl()}/api/admin/users/${encodeURIComponent(
      targetUserId,
    )}/subscription`;
    const res = await fetch(financeUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    const respBody = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: respBody?.error || "Subscription update failed at finance API" },
        { status: res.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[admin subscription proxy] unexpected error:", err?.message ?? e);
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 });
  }
}
