import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const createAdminClient = () => {
  // During build time, env vars might not be available
  // Return null instead of creating invalid client
  if (!supabaseUrl || !supabaseServiceKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Missing Supabase environment variables for admin client');
    }
    return null;
  }

  try {
    return createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });
  } catch (error) {
    console.error('Failed to create Supabase admin client:', error);
    return null;
  }
};

const globalForSupabase = global;

export const supabaseAdmin = globalForSupabase.supabaseAdmin || createAdminClient();

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabaseAdmin = supabaseAdmin;
}
