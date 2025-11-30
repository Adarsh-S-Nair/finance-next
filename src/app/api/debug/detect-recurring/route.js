import { detectRecurringTransactions } from '../../../../lib/recurring-detection';

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    console.log(`🔧 Debug: Force running recurring detection for user ${userId}`);

    // Run the detection logic
    const detected = await detectRecurringTransactions(userId);

    return Response.json({
      success: true,
      message: 'Recurring detection completed. Check server logs for details.',
      detected
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
