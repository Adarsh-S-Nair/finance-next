import { exchangePublicToken, getAccounts, getInstitution } from '../../../../lib/plaidClient';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    console.log('Getting accounts from Plaid...');
    const accountsResponse = await getAccounts(access_token);
    console.log('Full accounts response:', JSON.stringify(accountsResponse, null, 2));
    
    const { accounts, institution_id } = accountsResponse;
    console.log('Accounts received:', accounts.length, 'accounts for institution:', institution_id);
    
    // Check if institution_id is in the response
    if (!institution_id) {
      console.log('No institution_id found in accounts response, checking item data...');
      // Sometimes institution_id is in the item object
      const itemInstitutionId = accountsResponse.item?.institution_id;
      console.log('Item institution_id:', itemInstitutionId);
    }

    // Get institution info (with fallback)
    console.log('Getting institution info...');
    let institution = null;
    let institutionData = null;
    
    // Try to get institution_id from different possible locations
    const actualInstitutionId = institution_id || accountsResponse.item?.institution_id;
    console.log('Using institution_id:', actualInstitutionId);
    
    if (actualInstitutionId) {
      try {
        institution = await getInstitution(actualInstitutionId);
        console.log('Institution info received:', institution.name);

        // Upsert institution in database
        const { data: instData, error: institutionError } = await supabase
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
    } else {
      console.log('No institution_id available, skipping institution lookup');
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
    }));

    // Insert accounts (upsert to handle duplicates)
    const { data: accountsData, error: accountsError } = await supabase
      .from('accounts')
      .upsert(accountsToInsert, {
        onConflict: 'item_id,account_id'
      })
      .select();

    if (accountsError) {
      console.error('Error upserting accounts:', accountsError);
      return Response.json(
        { error: 'Failed to save accounts' },
        { status: 500 }
      );
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
