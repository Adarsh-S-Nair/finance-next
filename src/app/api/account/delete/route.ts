import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Get calling user's auth session via cookie header
    const authHeader = req.headers.get("Authorization");
    // In Next.js App Router, we can't directly use user session on server without a helper; instead,
    // we rely on client to provide current access token in Authorization: Bearer <token> header.
    if (!authHeader?.toLowerCase().startsWith("bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const accessToken = authHeader.split(" ")[1];
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create admin client with service role for user deletion
    const admin = createClient(supabaseUrl, serviceKey);

    // Validate the token to fetch the user id
    const { data: tokenUser, error: tokenErr } = await admin.auth.getUser(accessToken);
    if (tokenErr || !tokenUser?.user?.id) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const userId = tokenUser.user.id;

    // Clean up profile data first (optional; cascade can handle in DB if configured)
    const { error: profileErr } = await admin.from("user_profiles").delete().eq("id", userId);
    if (profileErr && profileErr.code !== "PGRST116") {
      // ignore not-found; otherwise propagate
      return NextResponse.json({ error: profileErr.message }, { status: 400 });
    }

    // Delete auth user
    const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}


