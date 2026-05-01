import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * Returns the current category_id for a single transaction owned by
 * the calling user. Used by RecategorizationWidget to detect when a
 * proposal has already been accepted in a previous session — the
 * widget renders its accepted state instead of asking the user to
 * confirm a change that's already been made.
 *
 * Why this exists at all: widget state is purely client-side. After
 * page reload / conversation switch, the widget remounts at idle
 * and would show the accept/decline UI again for an already-accepted
 * proposal. Rather than persist UI state to the message-block schema,
 * we just check the source of truth (the transaction's category)
 * each time the widget mounts.
 */
export const GET = withAuth(
  'agent:transaction-category',
  async (req: NextRequest, userId: string) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id')?.trim();
    if (!id) {
      return NextResponse.json(
        { error: 'id query param is required' },
        { status: 400 },
      );
    }

    // Auth scope: tx must belong to one of the user's accounts.
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .select('id, category_id, accounts!inner(user_id)')
      .eq('id', id)
      .eq('accounts.user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[agent:transaction-category] lookup failed', error);
      return NextResponse.json(
        { error: 'Failed to load transaction' },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ category_id: data.category_id });
  },
);
