import { removeItem } from '../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';

/**
 * Disconnect a single account from an institution
 * 
 * CRITICAL LOGIC:
 * - If this is the LAST account for the Plaid item:
 *   1. Call Plaid's /item/remove API FIRST (to avoid being billed for unused items)
 *   2. Then delete the account and all associated data from our database
 * - If there are other accounts still associated with the Plaid item:
 *   1. Just delete this account's data (cascades to transactions, snapshots)
 *   2. Do NOT call Plaid's /item/remove
 */
export async function POST(request) {
  try {
    const { accountId, userId } = await request.json();

    console.log('Disconnect account request - accountId:', accountId, 'userId:', userId);

    if (!accountId || !userId) {
      return Response.json(
        { error: 'Account ID and user ID are required' },
        { status: 400 }
      );
    }

    // Step 1: Get the account details including its plaid_item_id
    const { data: account, error: accountError } = await supabaseAdmin
      .from('accounts')
      .select(`
        *,
        plaid_items (
          id,
          item_id,
          access_token
        )
      `)
      .eq('id', accountId)
      .eq('user_id', userId)
      .single();

    if (accountError || !account) {
      console.error('Account not found:', accountError);
      return Response.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    const plaidItemId = account.plaid_item_id;
    const plaidItem = account.plaid_items;

    console.log('Found account:', account.name, 'plaid_item_id:', plaidItemId);

    // Step 2: Count how many accounts are associated with this Plaid item
    const { count: accountCount, error: countError } = await supabaseAdmin
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('plaid_item_id', plaidItemId)
      .eq('user_id', userId);

    if (countError) {
      console.error('Error counting accounts:', countError);
      return Response.json(
        { error: 'Failed to check related accounts' },
        { status: 500 }
      );
    }

    console.log('Account count for this Plaid item:', accountCount);

    const isLastAccount = accountCount === 1;

    // Step 3: If this is the LAST account, call Plaid's /item/remove FIRST
    if (isLastAccount && plaidItem?.access_token) {
      console.log('This is the LAST account for this Plaid item. Calling Plaid /item/remove API FIRST...');
      
      try {
        await removeItem(plaidItem.access_token);
        console.log('Plaid /item/remove API call successful');
      } catch (plaidError) {
        console.error('Plaid /item/remove API failed:', plaidError);
        // CRITICAL: Do NOT proceed with database deletion if Plaid API fails
        // This prevents orphaned items that user would be billed for
        return Response.json(
          { 
            error: 'Failed to disconnect from Plaid. Please try again.', 
            details: plaidError.message || 'Unknown Plaid error' 
          },
          { status: 500 }
        );
      }
    } else {
      console.log('Not the last account - skipping Plaid /item/remove (still needed for other accounts)');
    }

    // Step 4: Delete the account from our database
    // This will CASCADE delete:
    //   - transactions (via transactions.account_id on delete cascade)
    //   - account_snapshots (via account_snapshots.account_id on delete cascade)
    // And SET NULL for:
    //   - portfolios.source_account_id (on delete set null)
    console.log('Deleting account from database...');
    
    const { error: deleteAccountError } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .eq('user_id', userId);

    if (deleteAccountError) {
      console.error('Error deleting account:', deleteAccountError);
      return Response.json(
        { error: 'Failed to delete account from database', details: deleteAccountError.message },
        { status: 500 }
      );
    }

    console.log('Account deleted successfully');

    // Step 5: If this was the last account, also delete the plaid_item record
    if (isLastAccount && plaidItemId) {
      console.log('Deleting orphaned plaid_item record...');
      
      const { error: deletePlaidItemError } = await supabaseAdmin
        .from('plaid_items')
        .delete()
        .eq('id', plaidItemId)
        .eq('user_id', userId);

      if (deletePlaidItemError) {
        console.error('Error deleting plaid_item:', deletePlaidItemError);
        // Log but don't fail - the Plaid connection is already removed
        // and the account is deleted
      } else {
        console.log('Plaid item record deleted successfully');
      }
    }

    return Response.json({
      success: true,
      message: 'Account disconnected successfully',
      wasLastAccount: isLastAccount
    });

  } catch (error) {
    console.error('Error in disconnect-account process:', error);
    return Response.json(
      { error: 'Failed to disconnect account', details: error.message },
      { status: 500 }
    );
  }
}

