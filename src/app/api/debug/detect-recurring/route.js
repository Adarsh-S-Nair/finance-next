import { detectRecurringTransactions } from '../../../../lib/recurring-detection';

export async function POST(request) {
  try {
    const { userId, clearBeforeRun } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    console.log(`🔧 Debug: Force running recurring detection for user ${userId} (Clear: ${clearBeforeRun})`);

    if (clearBeforeRun) {
      const { supabaseAdmin } = await import('../../../../lib/supabaseAdmin');
      const { error: deleteError } = await supabaseAdmin
        .from('recurring_transactions')
        .delete()
        .eq('user_id', userId);

      if (deleteError) {
        console.error('❌ Failed to clear existing recurring transactions:', deleteError);
        throw new Error('Failed to clear existing data');
      }
      console.log('🧹 Cleared existing recurring transactions.');
    }

    // Run the detection logic
    const detected = await detectRecurringTransactions(userId);

    return Response.json({
      success: true,
      message: 'Recurring detection completed.',
      detected
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
