import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Auth callback handler — exchanges a Supabase PKCE code for a session
 * and redirects to the appropriate page.
 *
 * Usage: Set Supabase "Redirect URLs" to include:
 *   - http://localhost:3000/auth/callback (dev)
 *   - https://your-domain.com/auth/callback (prod)
 *
 * The forgot-password flow sends redirectTo = origin + /auth/callback?next=/auth/reset-password
 */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(`${origin}/auth`);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback] Code exchange failed:", error.message);
    // Redirect to reset-password page anyway — it will show "link expired" message
    return NextResponse.redirect(`${origin}/auth/reset-password`);
  }

  // Code exchanged successfully — redirect to the target page
  // The client-side Supabase will pick up the session from the cookie/storage
  // We pass a hash fragment so the client knows the session was just established
  return NextResponse.redirect(`${origin}${next}`);
}
