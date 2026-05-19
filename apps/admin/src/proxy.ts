import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedAdmin } from "./lib/auth/admin";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const ZERVO_APP_URL =
  process.env.NEXT_PUBLIC_ZERVO_APP_URL ?? "https://www.zervo.app";

// Paths that do NOT require auth. /auth/sso receives a session from the
// main zervo app; /not-authorized is the landing page for users who
// signed in but aren't on the ADMIN_EMAILS allowlist.
const PUBLIC_PATHS = ["/auth/sso", "/not-authorized"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPublic(pathname)) {
    return response;
  }

  // Not signed in — bounce to the main zervo app to authenticate, then
  // back here via the SSO handoff. We don't show Google OAuth on the
  // admin subdomain at all; auth is centralized on zervo.app.
  if (!user) {
    const currentUrl = `${request.nextUrl.origin}${pathname}${search}`;
    const url = new URL(`${ZERVO_APP_URL}/auth`);
    url.searchParams.set("next", currentUrl);
    return NextResponse.redirect(url);
  }

  // Signed in but not on the allowlist — show the not-authorized page.
  if (!isAllowedAdmin(user.email)) {
    const url = request.nextUrl.clone();
    url.pathname = "/not-authorized";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
