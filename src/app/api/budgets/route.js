import { supabaseAdmin } from '../../../lib/supabase/admin';
import { getBudgetProgress, getMonthlyBurn, getBudgetHistory, upsertBudget, deleteBudget } from '../../../lib/spending';
import { requireVerifiedUserId } from '../../../lib/api/auth';
import { canAccess } from '../../../lib/tierConfig';

async function requireTierAccess(userId, feature) {
  const { data: userProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();
  const tier = userProfile?.subscription_tier || 'free';
  if (!canAccess(tier, feature)) {
    return Response.json({ error: 'feature_locked', feature }, { status: 403 });
  }
  return null;
}

export async function GET(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const tierError = await requireTierAccess(userId, 'budgets');
    if (tierError) return tierError;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // Optional YYYY-MM-DD

    const [data, burn, history] = await Promise.all([
      getBudgetProgress(supabaseAdmin, userId, month),
      getMonthlyBurn(supabaseAdmin, userId, month),
      getBudgetHistory(supabaseAdmin, userId, 6),
    ]);
    return Response.json({ data, burn, history });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error fetching budgets:', error);
    return Response.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const tierError = await requireTierAccess(userId, 'budgets');
    if (tierError) return tierError;
    const body = await request.json();
    const { userId: _ignoredUserId, monthly_income, ...budgetData } = body;

    // If the client is sending the confirmed monthly income from the
    // creation flow's IncomeStep, persist it on user_profiles so the
    // budgets page can use it as the source of truth instead of
    // recomputing on every visit.
    if (monthly_income != null && !Number.isNaN(Number(monthly_income))) {
      await supabaseAdmin
        .from('user_profiles')
        .update({ monthly_income: Number(monthly_income) })
        .eq('id', userId);
    }

    // Ensure user_id is set in the data passed to upsert
    const budget = await upsertBudget(supabaseAdmin, { ...budgetData, user_id: userId });
    return Response.json({ data: budget });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error saving budget:', error);
    return Response.json({ error: 'Failed to save budget' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const tierError = await requireTierAccess(userId, 'budgets');
    if (tierError) return tierError;
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return Response.json({ error: 'ID is required' }, { status: 400 });
    }

    await deleteBudget(supabaseAdmin, id, userId);
    return Response.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error deleting budget:', error);
    return Response.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
