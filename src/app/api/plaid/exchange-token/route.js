import { exchangePublicToken, getAccounts, getInstitution } from '../../../../lib/plaidClient';
import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createAccountSnapshots } from '../../../../lib/accountSnapshotUtils';

export async function POST(request) {
  try {
    const { publicToken, userId } = await request.json();

    if (!publicToken || !userId) {
      return Response.json(
        { error: 'Public token and user ID are required' },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    const tokenResponse = await exchangePublicToken(publicToken);
    const { access_token, item_id } = tokenResponse;

    // Get accounts from Plaid
    const accountsResponse = await getAccounts(access_token);
    const { accounts, institution_id } = accountsResponse;
    console.log(`📊 Found ${accounts.length} accounts for institution: ${institution_id || accountsResponse.item?.institution_id}`);
    
    // Debug logging for account details
    console.log('🔍 DEBUG: Full accounts response from exchange-token:', JSON.stringify(accountsResponse, null, 2));
    console.log('🔍 DEBUG: Individual accounts from exchange-token:', accounts.map(acc => ({
      account_id: acc.account_id,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype,
      mask: acc.mask
    })));
    
    // Get institution info (with fallback)
    let institution = null;
    let institutionData = null;
    
    // Try to get institution_id from different possible locations
    const actualInstitutionId = institution_id || accountsResponse.item?.institution_id;
    
    if (actualInstitutionId) {
      try {
        institution = await getInstitution(actualInstitutionId);

        // Upsert institution in database
        const { data: instData, error: institutionError } = await supabaseAdmin
          .from('institutions')
          .upsert({
            institution_id: institution.institution_id,
            name: institution.name,
            logo: institution.logo,
            primary_color: institution.primary_color,
            url: institution.url,
          }, {
            onConflict: 'institution_id'
          })
          .select()
          .single();

        if (institutionError) {
          console.error('Error upserting institution:', institutionError);
          // Don't fail the whole process, just log the error
        } else {
          institutionData = instData;
        }
      } catch (instError) {
        console.error('Error getting institution info, continuing without it:', instError);
        // Continue without institution info - not critical for account creation
      }
    }

    // First, create or update the plaid_item
    const { data: plaidItemData, error: plaidItemError } = await supabaseAdmin
      .from('plaid_items')
      .upsert({
        user_id: userId,
        item_id: item_id,
        access_token: access_token,
        sync_status: 'idle'
      }, {
        onConflict: 'user_id,item_id'
      })
      .select()
      .single();

    if (plaidItemError) {
      console.error('Error upserting plaid item:', plaidItemError);
      return Response.json(
        { error: 'Failed to save plaid item', details: plaidItemError.message },
        { status: 500 }
      );
    }

    // Process and save accounts
    const accountsToInsert = accounts.map(account => ({
      user_id: userId,
      item_id: item_id,
      account_id: account.account_id,
      name: account.name,
      mask: account.mask,
      type: account.type,
      subtype: account.subtype,
      balances: account.balances,
      access_token: access_token,
      account_key: `${item_id}_${account.account_id}`,
      institution_id: institutionData?.id || null,
      plaid_item_id: plaidItemData.id, // Link to plaid_items table
    }));

    // Insert accounts (upsert to handle duplicates)
    const { data: accountsData, error: accountsError } = await supabaseAdmin
      .from('accounts')
      .upsert(accountsToInsert, {
        onConflict: 'plaid_item_id,account_id'
      })
      .select();

    if (accountsError) {
      console.error('Error upserting accounts:', accountsError);
      return Response.json(
        { error: 'Failed to save accounts', details: accountsError.message },
        { status: 500 }
      );
    }

    console.log(`✅ Saved ${accountsData.length} accounts successfully`);
    console.log('🔍 DEBUG: Saved accounts:', accountsData.map(acc => ({
      id: acc.id,
      account_id: acc.account_id,
      name: acc.name,
      type: acc.type,
      subtype: acc.subtype
    })));

    // Create account snapshots for the newly created accounts
    try {
      console.log('📸 Creating account snapshots...');
      const snapshotResult = await createAccountSnapshots(accounts, accountsData.map(acc => acc.id));
      
      if (snapshotResult.success) {
        console.log(`✅ Created ${snapshotResult.data.length} account snapshots successfully`);
      } else {
        console.warn('⚠️ Failed to create account snapshots:', snapshotResult.error);
        // Don't fail the whole process if snapshot creation fails
      }
    } catch (snapshotError) {
      console.warn('Error creating account snapshots:', snapshotError);
      // Don't fail the whole process if snapshot creation fails
    }

    // Trigger transaction sync for the new plaid item
    try {
      console.log('🔄 Starting transaction sync...');
      const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/plaid/transactions/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plaidItemId: plaidItemData.id,
          userId: userId
        })
      });

      if (!syncResponse.ok) {
        console.warn('⚠️ Transaction sync failed, but account linking succeeded');
      } else {
        const syncResult = await syncResponse.json();
        console.log(`✅ Transaction sync completed: ${syncResult.transactions_synced} transactions synced`);
      }
    } catch (syncError) {
      console.warn('Error triggering transaction sync:', syncError);
      // Don't fail the whole process if sync fails
    }

    return Response.json({
      success: true,
      accounts: accountsData,
      institution: institutionData || null,
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    return Response.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
