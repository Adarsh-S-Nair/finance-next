import { supabaseAdmin } from '../../../lib/supabase/admin';
import {
  getBudgetProgress,
  getMonthlyBurn,
  getBudgetHistory,
  upsertBudget,
  deleteBudget,
} from '../../../lib/spending';
import { withAuth } from '../../../lib/api/withAuth';
import { canAccess } from '../../../lib/tierConfig';
import type { TablesInsert } from '../../../types/database';

async function requireTierAccess(userId: string, feature: string): Promise<Response | null> {
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

export const GET = withAuth('budgets:list', async (request, userId) => {
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
});

interface SaveBudgetBody {
  userId?: string;
  monthly_income?: number | string | null;
  // Remaining fields are passed through as the budget payload.
  [key: string]: unknown;
}

export const POST = withAuth('budgets:save', async (request, userId) => {
  const tierError = await requireTierAccess(userId, 'budgets');
  if (tierError) return tierError;
  const body = (await request.json()) as SaveBudgetBody;
  const { userId: _ignoredUserId, monthly_income, ...budgetData } = body;
  void _ignoredUserId;

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

  const budget = await upsertBudget(supabaseAdmin, {
    ...(budgetData as Omit<TablesInsert<'budgets'>, 'user_id'>),
    user_id: userId,
  });
  return Response.json({ data: budget });
});

export const DELETE = withAuth('budgets:delete', async (request, userId) => {
  const tierError = await requireTierAccess(userId, 'budgets');
  if (tierError) return tierError;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return Response.json({ error: 'ID is required' }, { status: 400 });
  }

  await deleteBudget(supabaseAdmin, id, userId);
  return Response.json({ success: true });
});
