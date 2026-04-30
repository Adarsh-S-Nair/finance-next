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

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const admin = await resolveAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { id } = await ctx.params;
  const res = await fetch(
    `${getFinanceApiUrl()}/api/admin/impersonation/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      cache: "no-store",
    },
  );

  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status });
}
