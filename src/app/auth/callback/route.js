// This file intentionally left as a redirect-only handler.
// The actual code exchange happens client-side in the page component below.
// Keeping this file prevents 404s if someone hits the route directly without JS.

import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  // Pass code + next to the client-side page via query params
  if (code) {
    return NextResponse.redirect(`${origin}/auth/callback/exchange?code=${encodeURIComponent(code)}&next=${encodeURIComponent(next)}`);
  }

  return NextResponse.redirect(`${origin}/auth`);
}
