import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// During build time, env vars may not be present — the original module
// returned `null` and callers null-checked defensively. We keep that
// runtime behavior, but the *type* is non-null so the dozens of existing
// callers (.from(...), .select(...), etc.) typecheck without each one
// having to narrow against `null`. The defensive `if (!supabaseAdmin)`
// guards existing callers already have are still valid at runtime.
const createAdminClient = (): SupabaseClient<Database> | null => {
  if (!supabaseUrl || !supabaseServiceKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Missing Supabase environment variables for admin client');
    }
    return null;
  }

  try {
    return createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  } catch (error) {
    console.error('Failed to create Supabase admin client:', error);
    return null;
  }
};

const globalForSupabase = global as typeof globalThis & {
  supabaseAdmin?: SupabaseClient<Database> | null;
};

const client = globalForSupabase.supabaseAdmin ?? createAdminClient();

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabaseAdmin = client;
}

export const supabaseAdmin = client as SupabaseClient<Database>;
