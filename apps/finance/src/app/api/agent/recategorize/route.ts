import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * Commits a category change for a single transaction.
 *
 * The agent's `propose_recategorization` tool only RENDERS a proposal —
 * the actual write happens here, gated behind the user clicking Accept
 * in the RecategorizationWidget. This split keeps the model from making
 * unilateral writes: every database mutation requires explicit user
 * intent at the UI level.
 *
 * We mirror the field set used by the transactions page when the user
 * picks a category manually:
 *   - is_user_categorized = true so future Plaid syncs preserve the
 *     choice instead of resetting to the PFC the API returns.
 *   - is_unmatched_transfer = false so any stale "needs attention"
 *     warning clears in the same operation.
 */
export const POST = withAuth(
  'agent:recategorize',
  async (req: NextRequest, userId: string) => {
    const body = (await req.json().catch(() => ({}))) as {
      transaction_id?: string;
      category_id?: string;
    };

    const transactionId = body.transaction_id?.trim();
    const categoryId = body.category_id?.trim();
    if (!transactionId || !categoryId) {
      return NextResponse.json(
        { error: 'transaction_id and category_id are required' },
        { status: 400 },
      );
    }

    // Auth check: confirm the transaction belongs to the calling user.
    // The admin client bypasses RLS, so we have to scope manually.
    const { data: tx, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, accounts!inner(user_id)')
      .eq('id', transactionId)
      .eq('accounts.user_id', userId)
      .maybeSingle();

    if (txError) {
      console.error('[agent:recategorize] tx lookup failed', txError);
      return NextResponse.json({ error: 'Failed to load transaction' }, { status: 500 });
    }
    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    // Verify the target category exists. system_categories is a global
    // table — every user picks from the same set — so we don't need to
    // scope by user_id.
    const { data: cat, error: catError } = await supabaseAdmin
      .from('system_categories')
      .select('id, label')
      .eq('id', categoryId)
      .maybeSingle();

    if (catError) {
      console.error('[agent:recategorize] category lookup failed', catError);
      return NextResponse.json({ error: 'Failed to load category' }, { status: 500 });
    }
    if (!cat) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        category_id: categoryId,
        is_user_categorized: true,
        is_unmatched_transfer: false,
      })
      .eq('id', transactionId);

    if (updateError) {
      console.error('[agent:recategorize] update failed', updateError);
      return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  },
);
