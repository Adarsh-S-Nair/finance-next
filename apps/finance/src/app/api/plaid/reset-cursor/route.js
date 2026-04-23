import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { withAuth } from '../../../../lib/api/withAuth';

export const POST = withAuth('plaid:reset-cursor', async (request, userId) => {
    // 1. Reset cursors for all items belonging to this user
    const { error: updateError } = await supabaseAdmin
      .from('plaid_items')
      .update({ transaction_cursor: null })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to reset cursors:', updateError);
      return Response.json({ error: 'Failed to reset cursors' }, { status: 500 });
    }

    // 2. Get all items to trigger sync
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('plaid_items')
      .select('id')
      .eq('user_id', userId);

    if (itemsError) {
      console.error('Failed to fetch items:', itemsError);
      return Response.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    // 3. Trigger sync for each item
    // We'll call the sync endpoint for each item
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const baseUrl = `${protocol}://${host}`;

    const syncResults = [];

    // Forward the Authorization header so middleware can verify the request
    const authHeader = request.headers.get('Authorization');
    const cookieHeader = request.headers.get('cookie');
    const forwardHeaders = { 'Content-Type': 'application/json' };
    if (authHeader) forwardHeaders['Authorization'] = authHeader;
    if (cookieHeader) forwardHeaders['cookie'] = cookieHeader;

    for (const item of items) {
      try {
        console.log(`Triggering sync for item ${item.id}...`);
        const syncRes = await fetch(`${baseUrl}/api/plaid/transactions/sync`, {
          method: 'POST',
          headers: forwardHeaders,
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
        syncResults.push({ itemId: item.id, success: false });
      }
    }

    return Response.json({
      success: true,
      message: 'Cursors reset and sync triggered',
      results: syncResults
    });
});
