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
      // Backward compat: single id is still accepted.
      transaction_id?: string;
      transaction_ids?: string[];
      category_id?: string;
    };

    const ids = Array.isArray(body.transaction_ids)
      ? body.transaction_ids.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : body.transaction_id
        ? [body.transaction_id.trim()]
        : [];
    const categoryId = body.category_id?.trim();

    if (ids.length === 0 || !categoryId) {
      return NextResponse.json(
        {
          error:
            'transaction_ids (or transaction_id) and category_id are required',
        },
        { status: 400 },
      );
    }

    // Auth check: every transaction must belong to one of the caller's
    // accounts. We also pull `amount` here so we can validate the
    // category direction below without a second round trip.
    const { data: ownedTxs, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, amount, accounts!inner(user_id)')
      .in('id', ids)
      .eq('accounts.user_id', userId);

    if (txError) {
      console.error('[agent:recategorize] tx lookup failed', txError);
      return NextResponse.json({ error: 'Failed to load transactions' }, { status: 500 });
    }
    if (!ownedTxs || ownedTxs.length !== ids.length) {
      return NextResponse.json(
        { error: 'One or more transactions not found' },
        { status: 404 },
      );
    }

    const { data: cat, error: catError } = await supabaseAdmin
      .from('system_categories')
      .select('id, label, direction')
      .eq('id', categoryId)
      .maybeSingle();

    if (catError) {
      console.error('[agent:recategorize] category lookup failed', catError);
      return NextResponse.json({ error: 'Failed to load category' }, { status: 500 });
    }
    if (!cat) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Direction guard: positive-amount txs can only use income/both
    // categories; negative-amount txs can only use expense/both. The DB
    // trigger enforces this too, but we check up-front so the caller
    // (and the agent UI) gets a clean 400 with a useful message instead
    // of a raw check_violation rolling back the whole bulk update.
    if (cat.direction === 'income' || cat.direction === 'expense') {
      const mismatched = ownedTxs.filter((t) => {
        const amt = Number(t.amount);
        if (!Number.isFinite(amt) || amt === 0) return false;
        return cat.direction === 'income' ? amt < 0 : amt > 0;
      });
      if (mismatched.length > 0) {
        return NextResponse.json(
          {
            error:
              cat.direction === 'income'
                ? `Cannot assign income category "${cat.label}" to ${mismatched.length} negative-amount transaction(s)`
                : `Cannot assign expense category "${cat.label}" to ${mismatched.length} positive-amount transaction(s)`,
          },
          { status: 400 },
        );
      }
    }

    // Bulk update — same field set as a single update would use, just
    // applied to all ids in one round trip. The .in() filter combined
    // with the auth check above means we only touch the user's rows.
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({
        category_id: categoryId,
        is_user_categorized: true,
        is_unmatched_transfer: false,
      })
      .in('id', ids);

    if (updateError) {
      console.error('[agent:recategorize] update failed', updateError);
      return NextResponse.json({ error: 'Failed to update transactions' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, count: ids.length });
  },
);
