import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { getBudgetProgress, upsertBudget, deleteBudget } from '../../../lib/spending';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const month = searchParams.get('month'); // Optional YYYY-MM-DD

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    const data = await getBudgetProgress(supabaseAdmin, userId, month);
    return Response.json({ data });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return Response.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, ...budgetData } = body;

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Ensure user_id is set in the data passed to upsert
    const budget = await upsertBudget(supabaseAdmin, { ...budgetData, user_id: userId });
    return Response.json({ data: budget });
  } catch (error) {
    console.error('Error saving budget:', error);
    return Response.json({ error: 'Failed to save budget' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) {
      return Response.json({ error: 'ID and User ID are required' }, { status: 400 });
    }

    await deleteBudget(supabaseAdmin, id, userId);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Error deleting budget:', error);
    return Response.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
