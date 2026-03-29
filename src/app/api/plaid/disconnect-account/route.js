import { removeItem } from '../../../../lib/plaid/client';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

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
    const userId = requireVerifiedUserId(request);
    const { accountId } = await request.json();
    console.log('Disconnect account request - accountId:', accountId, 'userId:', userId);
    if (!accountId) {
      return Response.json(
        { error: 'Account ID is required' },
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
    // Step 2: Delete the account from our database FIRST
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
    // Step 3: AFTER deleting, re-check remaining account count for this Plaid item.
    // This post-delete check is race-safe: whichever concurrent request deletes last
    // will see count=0 and be responsible for removing the Plaid item.
    const { count: remainingCount, error: countError } = await supabaseAdmin
      .from('accounts')
      .select('id', { count: 'exact', head: true })
      .eq('plaid_item_id', plaidItemId)
      .eq('user_id', userId);
    if (countError) {
      console.error('Error counting remaining accounts:', countError);
      // Don't fail the request — account is already deleted. Log and return success.
      console.warn('Could not verify remaining accounts for plaid_item cleanup; manual cleanup may be needed.');
      return Response.json({
        success: true,
        message: 'Account disconnected successfully',
        wasLastAccount: false
      });
    }
    console.log('Remaining accounts for this Plaid item after deletion:', remainingCount);
    const isLastAccount = remainingCount === 0;
    // Step 4: If no accounts remain, call Plaid's /item/remove and delete the plaid_item record
    if (isLastAccount && plaidItem?.access_token) {
      console.log('No accounts remain for this Plaid item. Calling Plaid /item/remove API...');
      
      try {
        await removeItem(plaidItem.access_token);
        console.log('Plaid /item/remove API call successful');
      } catch (plaidError) {
        const plaidErrorCode = plaidError?.response?.data?.error_code;
        const deadItemCodes = ['ITEM_NOT_FOUND', 'INVALID_ACCESS_TOKEN', 'ITEM_LOGIN_REQUIRED'];
        if (deadItemCodes.includes(plaidErrorCode)) {
          console.warn(`Plaid item already removed or invalid (${plaidErrorCode}). Proceeding with DB cleanup.`);
        } else {
          console.error('Plaid /item/remove API failed:', plaidError);
          // Account is already deleted — log the error but don't block the response.
          // The plaid_item will remain as an orphan; a background cleanup job can handle it.
          console.warn('Plaid item removal failed after account deletion; plaid_item record may need manual cleanup.');
          return Response.json({
            success: true,
            message: 'Account disconnected successfully',
            wasLastAccount: true,
            plaidRemovalWarning: 'Plaid item could not be removed — please reconnect or contact support.'
          });
        }
      }

      console.log('Deleting orphaned plaid_item record...');
      const { error: deletePlaidItemError } = await supabaseAdmin
        .from('plaid_items')
        .delete()
        .eq('id', plaidItemId)
        .eq('user_id', userId);
      if (deletePlaidItemError) {
        console.error('Error deleting plaid_item:', deletePlaidItemError);
        // Log but don't fail — the Plaid connection is already removed and the account is deleted
      } else {
        console.log('Plaid item record deleted successfully');
      }
    } else if (!isLastAccount) {
      console.log('Other accounts still exist for this Plaid item - skipping /item/remove');
    }
    return Response.json({
      success: true,
      message: 'Account disconnected successfully',
      wasLastAccount: isLastAccount
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error in disconnect-account process:', error);
    return Response.json(
      { error: 'Failed to disconnect account', details: error.message },
      { status: 500 }
    );
  }
}
