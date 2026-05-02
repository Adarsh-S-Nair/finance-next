import { NextResponse, type NextRequest } from 'next/server';
import { withAuth } from '../../../../lib/api/withAuth';
import { supabaseAdmin } from '../../../../lib/supabase/admin';

/**
 * Commits a budget create / update / delete on the user's behalf, gated
 * by user confirmation in the agent's BudgetProposalWidget.
 *
 * One endpoint, three actions, dispatched on `action`. The agent's three
 * propose tools (propose_budget_create / _update / _delete) all funnel
 * here when the widget's accept button is clicked. Keeping it one route
 * keeps the widget's accept handler simple and the auth/validation logic
 * in one place.
 *
 * Auth is scoped via user_id on every read and write. The admin client
 * bypasses RLS, so we rely on explicit user_id filters here.
 */

type CreateBody = {
  action: 'create';
  category_id?: string | null;
  category_group_id?: string | null;
  amount: number;
};

type UpdateBody = {
  action: 'update';
  budget_id: string;
  amount: number;
};

type DeleteBody = {
  action: 'delete';
  budget_id: string;
};

type RequestBody = CreateBody | UpdateBody | DeleteBody;

export const POST = withAuth(
  'agent:budgets:write',
  async (req: NextRequest, userId: string) => {
    const body = (await req.json().catch(() => ({}))) as Partial<RequestBody> & {
      [k: string]: unknown;
    };

    if (body.action === 'create') {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: 'amount must be a positive number' },
          { status: 400 },
        );
      }
      const groupId = body.category_group_id ? String(body.category_group_id) : null;
      const categoryId = body.category_id ? String(body.category_id) : null;
      if (!groupId && !categoryId) {
        return NextResponse.json(
          { error: 'Provide either category_group_id or category_id' },
          { status: 400 },
        );
      }
      if (groupId && categoryId) {
        return NextResponse.json(
          { error: 'Provide either category_group_id OR category_id, not both' },
          { status: 400 },
        );
      }

      // Verify the target exists. system_categories / category_groups
      // are global tables — no user_id filter needed.
      if (groupId) {
        const { data, error } = await supabaseAdmin
          .from('category_groups')
          .select('id')
          .eq('id', groupId)
          .maybeSingle();
        if (error) {
          console.error('[agent:budgets:create] group lookup failed', error);
          return NextResponse.json({ error: 'Failed to load category group' }, { status: 500 });
        }
        if (!data) {
          return NextResponse.json({ error: 'Category group not found' }, { status: 404 });
        }
      } else if (categoryId) {
        const { data, error } = await supabaseAdmin
          .from('system_categories')
          .select('id')
          .eq('id', categoryId)
          .maybeSingle();
        if (error) {
          console.error('[agent:budgets:create] category lookup failed', error);
          return NextResponse.json({ error: 'Failed to load category' }, { status: 500 });
        }
        if (!data) {
          return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }
      }

      // Reject duplicates at write time too — defence in depth on top of
      // the propose-time check, in case state changed between proposal
      // and accept.
      const dupQuery = supabaseAdmin
        .from('budgets')
        .select('id')
        .eq('user_id', userId);
      const dupResult = groupId
        ? await dupQuery.eq('category_group_id', groupId).maybeSingle()
        : await dupQuery.eq('category_id', categoryId!).maybeSingle();

      if (dupResult.data) {
        return NextResponse.json(
          { error: 'A budget for this category already exists' },
          { status: 409 },
        );
      }

      const { error: insertErr } = await supabaseAdmin.from('budgets').insert({
        user_id: userId,
        category_group_id: groupId,
        category_id: categoryId,
        amount,
        period: 'monthly',
      });
      if (insertErr) {
        console.error('[agent:budgets:create] insert failed', insertErr);
        return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'update') {
      const budgetId = body.budget_id ? String(body.budget_id) : null;
      const amount = Number(body.amount);
      if (!budgetId || !Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: 'budget_id and a positive amount are required' },
          { status: 400 },
        );
      }
      const { data: existing, error: lookupErr } = await supabaseAdmin
        .from('budgets')
        .select('id')
        .eq('id', budgetId)
        .eq('user_id', userId)
        .maybeSingle();
      if (lookupErr) {
        console.error('[agent:budgets:update] lookup failed', lookupErr);
        return NextResponse.json({ error: 'Failed to load budget' }, { status: 500 });
      }
      if (!existing) {
        return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
      }
      const { error: updateErr } = await supabaseAdmin
        .from('budgets')
        .update({ amount })
        .eq('id', budgetId);
      if (updateErr) {
        console.error('[agent:budgets:update] update failed', updateErr);
        return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'delete') {
      const budgetId = body.budget_id ? String(body.budget_id) : null;
      if (!budgetId) {
        return NextResponse.json(
          { error: 'budget_id is required' },
          { status: 400 },
        );
      }
      // Auth check via user_id filter on delete — RLS bypassed by admin.
      const { error: deleteErr } = await supabaseAdmin
        .from('budgets')
        .delete()
        .eq('id', budgetId)
        .eq('user_id', userId);
      if (deleteErr) {
        console.error('[agent:budgets:delete] delete failed', deleteErr);
        return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "action must be 'create', 'update', or 'delete'" },
      { status: 400 },
    );
  },
);
