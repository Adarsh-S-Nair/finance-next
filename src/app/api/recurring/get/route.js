import { createClient } from '@supabase/supabase-js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return Response.json({ error: 'User ID is required' }, { status: 400 });
  }

  // Use authenticated client if possible, but for simplicity here we use the service role
  // In a real app, we should use the user's session from the request cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data, error } = await supabase
      .from('recurring_transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('next_date', { ascending: true });

    if (error) {
      throw error;
    }

    return Response.json({ recurring: data });
  } catch (error) {
    console.error('Error fetching recurring transactions:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
