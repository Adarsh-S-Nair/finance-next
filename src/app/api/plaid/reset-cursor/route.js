import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return Response.json({ error: 'User ID is required' }, { status: 400 });
    }

    // 1. Reset cursors for all items belonging to this user
    const { error: updateError } = await supabaseAdmin
      .from('plaid_items')
      .update({ transaction_cursor: null })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error(`Failed to reset cursors: ${updateError.message}`);
    }

    // 2. Get all items to trigger sync
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id')
      .eq('user_id', userId);

    if (itemsError) {
      throw new Error(`Failed to fetch items: ${itemsError.message}`);
    }

    // 3. Trigger sync for each item
    // We'll call the sync endpoint for each item
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    const syncResults = [];

    for (const item of items) {
      try {
        console.log(`Triggering sync for item ${item.id}...`);
        const syncRes = await fetch(`${baseUrl}/api/plaid/transactions/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            plaidItemId: item.id,
            userId: userId,
            forceSync: true
          })
        });

        const syncData = await syncRes.json();
        syncResults.push({ itemId: item.id, success: syncRes.ok, data: syncData });
      } catch (syncError) {
        console.error(`Failed to trigger sync for item ${item.id}:`, syncError);
        syncResults.push({ itemId: item.id, success: false, error: syncError.message });
      }
    }

    return Response.json({
      success: true,
      message: 'Cursors reset and sync triggered',
      results: syncResults
    });

  } catch (error) {
    console.error('Error in reset-cursor:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
