import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/auth/admin";

function getFinanceApiUrl(): string {
  return process.env.FINANCE_API_URL || "https://www.zervo.app";
}

async function resolveAdmin() {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return { ok: false as const, status: 401, error: "No admin session" };
  if (!isAllowedAdmin(userData.user.email)) {
    return { ok: false as const, status: 403, error: "Not on admin allowlist" };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false as const, status: 401, error: "Admin session has no access_token" };
  }
  return { ok: true as const, accessToken: session.access_token };
}

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const admin = await resolveAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { id } = await ctx.params;
  const res = await fetch(
    `${getFinanceApiUrl()}/api/admin/impersonation/${encodeURIComponent(id)}/start`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${admin.accessToken}`,
        // Pass the admin's request origin/UA through so finance can log it
        // on the impersonation_sessions row.
        "x-forwarded-for":
          req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "",
        "user-agent": req.headers.get("user-agent") ?? "",
      },
      cache: "no-store",
    },
  );

  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status });
}
