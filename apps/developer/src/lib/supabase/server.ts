import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  createAdminClient as createSharedAdminClient,
  type Database,
} from "@zervo/supabase";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore; the proxy
            // refreshes the session cookie on the next request.
          }
        },
      },
    },
  );
}

/**
 * Service-role client for server-side admin operations. NEVER expose this
 * client to the browser. Same factory as finance/admin — shared via
 * `@zervo/supabase` so all three apps see the same Database schema and
 * config.
 */
export function createAdminClient() {
  const client = createSharedAdminClient<Database>();
  if (!client) {
    throw new Error(
      "Supabase admin client unavailable — missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return client;
}
