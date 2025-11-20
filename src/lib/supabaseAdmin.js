import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Missing Supabase environment variables for admin client');
  }
}

const createAdminClient = () => {
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co', 
    supabaseServiceKey || 'placeholder', 
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  );
};

const globalForSupabase = global;

export const supabaseAdmin = globalForSupabase.supabaseAdmin || createAdminClient();

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.supabaseAdmin = supabaseAdmin;
}
