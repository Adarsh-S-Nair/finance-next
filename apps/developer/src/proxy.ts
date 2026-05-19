import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const ZERVO_APP_URL =
  process.env.NEXT_PUBLIC_ZERVO_APP_URL ?? "https://www.zervo.app";

// Paths that do NOT require auth. /auth/sso receives a session from the
// main zervo app.
const PUBLIC_PATHS = ["/auth/sso"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Next 16 "proxy" (middleware in older versions). Refreshes the Supabase
 * session cookie on every request and gates non-public paths behind
 * authentication. Authentication itself happens on www.zervo.app — we
 * don't host a Google OAuth flow here; unauthed requests bounce there
 * and come back via /auth/sso once a session exists.
 */
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

  if (!user) {
    const currentUrl = `${request.nextUrl.origin}${pathname}${search}`;
    const url = new URL(`${ZERVO_APP_URL}/auth`);
    url.searchParams.set("next", currentUrl);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
