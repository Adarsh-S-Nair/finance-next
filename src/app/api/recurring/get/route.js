import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/recurring/get
 * Retrieves recurring transaction streams for a user from the database.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const streamType = searchParams.get('streamType'); // 'inflow', 'outflow', or null for all

  if (!userId) {
    return Response.json({ error: 'User ID is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let query = supabase
      .from('recurring_streams')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .in('status', ['MATURE', 'EARLY_DETECTION']) // Only show active/detected streams
      .order('predicted_next_date', { ascending: true, nullsFirst: false });

    // Filter by stream type if specified
    if (streamType && ['inflow', 'outflow'].includes(streamType)) {
      query = query.eq('stream_type', streamType);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return Response.json({ recurring: data });
  } catch (error) {
    console.error('Error fetching recurring streams:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
