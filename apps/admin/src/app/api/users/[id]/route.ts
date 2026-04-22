import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/auth/admin";

type RouteContext = { params: Promise<{ id: string }> };

function getFinanceApiUrl(): string {
  // Must be the canonical host. zervo.app 301-redirects to www.zervo.app
  // and Node's fetch (undici) strips the Authorization header across
  // redirects, so hitting the apex here turns into a silent 401 at
  // finance's middleware with "Authentication required".
  return process.env.FINANCE_API_URL || "https://www.zervo.app";
}

/**
 * Resolve the admin's verified user + access_token, or describe why we
 * can't. We call getUser() first (round-trips to Supabase to actually
 * verify the JWT instead of trusting cookie state) and only then pull
 * the access_token off the session for forwarding. Returning distinct
 * error strings per failure mode is the difference between "I got 401"
 * being a 5-minute fix vs. a 30-minute debugging session.
 */
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

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const { id: targetUserId } = await context.params;
    if (!targetUserId) {
      return NextResponse.json({ error: "Missing user id" }, { status: 400 });
    }

    const admin = await resolveAdmin();
    if (!admin.ok) {
      return NextResponse.json({ error: admin.error }, { status: admin.status });
    }
    if (admin.userId === targetUserId) {
      return NextResponse.json(
        { error: "You can't delete your own admin account from here." },
        { status: 400 },
      );
    }

    const financeBase = getFinanceApiUrl();
    const financeUrl = `${financeBase}/api/admin/users/${encodeURIComponent(targetUserId)}`;
    console.log(`[admin users DELETE] ${admin.email} -> ${financeUrl}`);

    const res = await fetch(financeUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      const parts = [body?.error, body?.message].filter(Boolean);
      const detail = parts.length ? parts.join(" — ") : `finance returned ${res.status}`;
      return NextResponse.json(
        { error: `[finance ${res.status}] ${detail}` },
        { status: res.status },
      );
    }
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error("[admin users DELETE] unexpected error:", err?.message ?? e);
    return NextResponse.json(
      { error: err?.message || "Failed to delete user" },
      { status: 500 },
    );
  }
}
