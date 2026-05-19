import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@zervo/supabase";

/**
 * Browser Supabase client.
 *
 * Annotated as `SupabaseClient<Database>` (from `@supabase/supabase-js`)
 * because `createBrowserClient<Database>` from `@supabase/ssr@0.5.2`
 * doesn't propagate the Database generic into typed `.from()` queries —
 * the chain resolves to `never` and every column access fails to
 * typecheck. The runtime client is the same; we're just naming its type
 * with the package that actually defines the generic correctly.
 */
export function createClient(): SupabaseClient<Database> {
  // Cast through `unknown` because @supabase/ssr@0.5.2 ships a
  // `SupabaseClient` signature with a different arity than
  // @supabase/supabase-js@2.104.0 (the canonical type used everywhere
  // else in the codebase). Runtime instance is identical — only the
  // declared generic shape differs.
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ) as unknown as SupabaseClient<Database>;
}
