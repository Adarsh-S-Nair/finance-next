import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Window pagination API
// Params:
// - userId: required
// - direction: 'older' | 'newer' (required)
// - edgeId: transaction id that represents the current edge in the requested direction (required)
// - limit: number (default 20)
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const direction = (searchParams.get('direction') || '').toLowerCase();
    const edgeId = searchParams.get('edgeId');
    const limit = parseInt(searchParams.get('limit')) || 20;

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }
    if (!edgeId) {
      return Response.json({ error: 'edgeId is required' }, { status: 400 });
    }
    if (direction !== 'older' && direction !== 'newer') {
      return Response.json({ error: 'direction must be "older" or "newer"' }, { status: 400 });
    }

    // Lookup edge transaction to build a stable cursor on (datetime, created_at)
    const { data: edgeTx, error: edgeErr } = await supabase
      .from('transactions')
      .select('datetime, created_at')
      .eq('id', edgeId)
      .single();

    if (edgeErr || !edgeTx) {
      return Response.json({ error: 'Invalid edgeId' }, { status: 400 });
    }

    // Base select with joins
    const selectFragment = `
      *,
      accounts!inner (
        id,
        name,
        mask,
        type,
        user_id,
        institutions (
          id,
          name,
          logo
        )
      ),
      system_categories (
        id,
        label,
        category_groups (
          id,
          name,
          icon_lib,
          icon_name,
          hex_color
        )
      )
    `;

    let query;
    let reverseAfter = false;

    if (direction === 'older') {
      // Older than the edge (strictly)
      const olderFilter = `datetime.lt.${edgeTx.datetime},and(datetime.eq.${edgeTx.datetime},created_at.lt.${edgeTx.created_at})`;
      query = supabase
        .from('transactions')
        .select(selectFragment)
        .eq('accounts.user_id', userId)
        .or(olderFilter)
        .order('datetime', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
    } else {
      // Newer than the edge (strictly). Query ascending for contiguity then reverse.
      const newerFilter = `datetime.gt.${edgeTx.datetime},and(datetime.eq.${edgeTx.datetime},created_at.gt.${edgeTx.created_at})`;
      reverseAfter = true;
      query = supabase
        .from('transactions')
        .select(selectFragment)
        .eq('accounts.user_id', userId)
        .or(newerFilter)
        .order('datetime', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(limit);
    }

    const { data: rows, error } = await query;
    if (error) {
      console.error('Error fetching window transactions:', error);
      return Response.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    const ordered = reverseAfter ? (rows || []).slice().reverse() : rows || [];
    const transformed = ordered.map(t => ({
      ...t,
      account_name: t.accounts?.name || 'Unknown Account',
      institution_name: t.accounts?.institutions?.name || 'Unknown Institution',
      category_icon_lib: t.system_categories?.category_groups?.icon_lib || null,
      category_icon_name: t.system_categories?.category_groups?.icon_name || null,
      category_hex_color: t.system_categories?.category_groups?.hex_color || null,
      category_name: t.system_categories?.label || null
    }));

    const hasMoreOlder = direction === 'older' ? transformed.length === limit : undefined;
    const hasMoreNewer = direction === 'newer' ? transformed.length === limit : undefined;

    const newestId = transformed[0]?.id || null;
    const oldestId = transformed[transformed.length - 1]?.id || null;

    return Response.json({
      transactions: transformed,
      count: transformed.length,
      direction,
      edgeId,
      hasMoreOlder: Boolean(hasMoreOlder),
      hasMoreNewer: Boolean(hasMoreNewer),
      windowEdges: { newestId, oldestId }
    });
  } catch (err) {
    console.error('Error in window pagination API:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}



