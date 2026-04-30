import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/auth/admin";

function getFinanceApiUrl(): string {
  // zervo.app 301-redirects to www.zervo.app and undici strips the
  // Authorization header across redirects, so always hit the canonical
  // host directly.
  return process.env.FINANCE_API_URL || "https://www.zervo.app";
}

async function resolveAdmin(): Promise<
  | { ok: true; userId: string; email: string; accessToken: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: "No admin session" };
  }
  if (!isAllowedAdmin(userData.user.email)) {
    return { ok: false, status: 403, error: "Not on admin allowlist" };
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { ok: false, status: 401, error: "Admin session has no access_token" };
  }
  return {
    ok: true,
    userId: userData.user.id,
    email: userData.user.email ?? "",
    accessToken: session.access_token,
  };
}

export async function POST(req: NextRequest) {
  const admin = await resolveAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const body = await req.json().catch(() => ({}));
  const res = await fetch(`${getFinanceApiUrl()}/api/admin/impersonation`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${admin.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status });
}

export async function GET(req: NextRequest) {
  const admin = await resolveAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const target = req.nextUrl.searchParams.get("target");
  if (!target) {
    return NextResponse.json({ error: "target query param required" }, { status: 400 });
  }

  const res = await fetch(
    `${getFinanceApiUrl()}/api/admin/impersonation?target=${encodeURIComponent(target)}`,
    {
      headers: { Authorization: `Bearer ${admin.accessToken}` },
      cache: "no-store",
    },
  );

  const json = await res.json().catch(() => ({}));
  return NextResponse.json(json, { status: res.status });
}
