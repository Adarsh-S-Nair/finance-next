import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { isAllowedAdmin } from "@/lib/auth/admin";
import {
  encryptPlatformSecret,
  decryptPlatformSecret,
  maskPlatformSecret,
} from "@zervo/supabase";

/**
 * Admin-only platform config CRUD. Reads/writes go through the service-role
 * client; ADMIN_EMAILS gates access. Secret values are encrypted at rest
 * and never returned in plaintext — GET masks them to `••••XYZ4`.
 */

async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string }
> {
  const supabase = await createClient();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: "No admin session" };
  }
  if (!isAllowedAdmin(userData.user.email)) {
    return { ok: false, status: 403, error: "Caller is not on the admin allowlist" };
  }
  return { ok: true, userId: userData.user.id };
}

type ConfigRow = {
  key: string;
  value: string;
  is_secret: boolean;
  updated_at: string;
};

type DisplayRow = {
  key: string;
  value: string | null;
  display: string;
  is_secret: boolean;
  updated_at: string;
};

function toDisplay(row: ConfigRow): DisplayRow {
  if (row.is_secret) {
    let plain = "";
    try {
      plain = decryptPlatformSecret(row.value);
    } catch {
      // Corrupted ciphertext — surface as masked but flag in display.
      return {
        key: row.key,
        value: null,
        display: "•••• (decryption failed)",
        is_secret: true,
        updated_at: row.updated_at,
      };
    }
    return {
      key: row.key,
      value: null,
      display: maskPlatformSecret(plain),
      is_secret: true,
      updated_at: row.updated_at,
    };
  }
  return {
    key: row.key,
    value: row.value,
    display: row.value,
    is_secret: false,
    updated_at: row.updated_at,
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("platform_config")
    .select("key, value, is_secret, updated_at")
    .order("key", { ascending: true });
  if (error) {
    console.error("[admin platform-config GET]", error);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
  return NextResponse.json({ rows: (data ?? []).map(toDisplay) });
}

interface UpsertBody {
  key?: string;
  value?: string;
  is_secret?: boolean;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const body = (await req.json().catch(() => ({}))) as UpsertBody;
  const key = (body.key ?? "").trim();
  const rawValue = body.value;
  const isSecret = Boolean(body.is_secret);

  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return NextResponse.json({ error: "value is required" }, { status: 400 });
  }

  const stored = isSecret ? encryptPlatformSecret(rawValue.trim()) : rawValue.trim();

  const db = createAdminClient();
  const { error } = await db.from("platform_config").upsert(
    {
      key,
      value: stored,
      is_secret: isSecret,
      updated_by: admin.userId,
    },
    { onConflict: "key" },
  );
  if (error) {
    console.error("[admin platform-config POST]", error);
    return NextResponse.json({ error: "Upsert failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }
  const db = createAdminClient();
  const { error } = await db.from("platform_config").delete().eq("key", key);
  if (error) {
    console.error("[admin platform-config DELETE]", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
