import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, type Database } from "@zervo/supabase";

// Cache the client across hot-reloads in dev so we don't accumulate
// connections. Uses a global to survive module re-evaluation.
const globalForSupabase = global as typeof globalThis & {
  supabaseAdmin?: SupabaseClient<Database> | null;
};

const client = globalForSupabase.supabaseAdmin ?? createAdminClient<Database>();

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.supabaseAdmin = client;
}

// Existing call sites use `.from(...)` directly without null-narrowing —
// the runtime guard inside createAdminClient still returns null when env
// vars are missing (build time), but typing it as non-null avoids forcing
// every caller to defensively narrow.
export const supabaseAdmin = client as SupabaseClient<Database>;
