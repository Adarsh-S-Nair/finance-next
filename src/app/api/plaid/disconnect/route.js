import { removeItem } from '../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

export async function POST(request) {
  try {
    const { plaidItemId, userId } = await request.json();

    console.log('Disconnect request for plaid item:', plaidItemId, 'user:', userId);

    if (!plaidItemId || !userId) {
      return Response.json(
        { error: 'Plaid item ID and user ID are required' },
        { status: 400 }
      );
    }

    // Get the plaid item from database
    const { data: plaidItem, error: itemError } = await supabaseAdmin
      .from('plaid_items')
      .select('*')
      .eq('id', plaidItemId)
      .eq('user_id', userId)
      .single();

    if (itemError || !plaidItem) {
      console.error('Plaid item not found:', itemError);
      return Response.json(
        { error: 'Plaid item not found' },
        { status: 404 }
      );
    }

    console.log('Found plaid item:', plaidItem.item_id, 'access_token:', plaidItem.access_token ? 'present' : 'missing');

    // Step 1: Call Plaid's item/remove API
    console.log('Calling Plaid item/remove API...');
    try {
      await removeItem(plaidItem.access_token);
      console.log('Plaid item/remove API call successful');
    } catch (plaidError) {
      console.error('Plaid item/remove API failed:', plaidError);
      return Response.json(
        { 
          error: 'Failed to disconnect from Plaid', 
          details: plaidError.message || 'Unknown Plaid error' 
        },
        { status: 500 }
      );
    }

    // Step 2: Only if Plaid API succeeds, delete from our database
    console.log('Plaid API succeeded, now deleting from database...');
    
    // Delete the plaid_item (this will cascade to accounts and transactions due to foreign key constraints)
    const { error: deleteError } = await supabaseAdmin
      .from('plaid_items')
      .delete()
      .eq('id', plaidItemId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting plaid item from database:', deleteError);
      return Response.json(
        { error: 'Failed to remove from database', details: deleteError.message },
        { status: 500 }
      );
    }

    console.log('Successfully disconnected plaid item and removed from database');

    return Response.json({
      success: true,
      message: 'Institution disconnected successfully'
    });

  } catch (error) {
    console.error('Error in disconnect process:', error);
    return Response.json(
      { error: 'Failed to disconnect institution', details: error.message },
      { status: 500 }
    );
  }
}
