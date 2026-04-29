import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a service-role Supabase client for server-only admin operations
 * (reading the full user list, deleting users, anything that bypasses RLS).
 *
 * NEVER expose this client to the browser — the service role key has full
 * unrestricted DB access.
 *
 * Returns `null` when env vars are missing, which is the case during build
 * time on Vercel before secrets are wired up. Callers in long-lived
 * production code should null-check; one-shot scripts can assert the type.
 *
 * Pass the app's `Database` generic so query results are typed:
 *   const db = createAdminClient<Database>();
 */
export function createAdminClient<DB = unknown>(): SupabaseClient<DB> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[@zervo/supabase] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — admin client is null",
      );
    }
    return null;
  }

  try {
    return createClient<DB>(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error("[@zervo/supabase] Failed to create admin client:", error);
    return null;
  }
}
