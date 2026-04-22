import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/auth/admin";

type RouteContext = { params: Promise<{ id: string }> };

function getFinanceApiUrl(): string {
  // See /api/users/[id] route.ts — must be www host to avoid the apex
  // redirect that strips the Bearer token.
  return process.env.FINANCE_API_URL || "https://www.zervo.app";
}

async function resolveAdmin(): Promise<
  | { ok: true; userId: string; email: string; accessToken: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: "No admin session (getUser failed)" };
  }
  const user = userData.user;

  if (!isAllowedAdmin(user.email)) {
    return { ok: false, status: 403, error: "Caller is not on the admin allowlist" };
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return {
      ok: false,
      status: 401,
      error: "Admin session has no access_token to forward to finance",
    };
  }

  return {
    ok: true,
    userId: user.id,
    email: user.email ?? "",
    accessToken: session.access_token,
  };
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id: targetUserId } = await context.params;
    if (!targetUserId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const admin = await resolveAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }

    const body = await req.text();
    const financeBase = getFinanceApiUrl();
    const financeUrl = `${financeBase}/api/admin/users/${encodeURIComponent(
      targetUserId,
    )}/subscription`;
    console.log(`[admin subscription PATCH] ${admin.email} -> ${financeUrl}`);

    const res = await fetch(financeUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });

    const respBody = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      const parts = [respBody?.error, respBody?.message].filter(Boolean);
      const detail = parts.length ? parts.join(" — ") : `finance returned ${res.status}`;
      return NextResponse.json(
        { error: `[finance ${res.status}] ${detail}` },
        { status: res.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[admin subscription PATCH] unexpected error:", err?.message ?? e);
    return NextResponse.json(
      { error: err?.message || "Failed to update subscription" },
      { status: 500 },
    );
  }
}
