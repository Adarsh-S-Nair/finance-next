import { supabaseAdmin } from '../../../lib/supabase/admin';
import { getBudgetProgress, upsertBudget, deleteBudget } from '../../../lib/spending';
import { requireVerifiedUserId } from '../../../lib/api/auth';

export async function GET(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // Optional YYYY-MM-DD

    const data = await getBudgetProgress(supabaseAdmin, userId, month);
    return Response.json({ data });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error fetching budgets:', error);
    return Response.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const body = await request.json();
    const { userId: _ignoredUserId, ...budgetData } = body;

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
