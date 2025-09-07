import { exchangePublicToken, getAccounts, getInstitution } from '@/lib/plaidClient';
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
    const accountsResponse = await getAccounts(access_token);
    const { accounts, institution_id } = accountsResponse;

    // Get institution info
    const institution = await getInstitution(institution_id);

    // Upsert institution in database
    const { data: institutionData, error: institutionError } = await supabase
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
      return Response.json(
        { error: 'Failed to save institution' },
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
      institution_id: institutionData.id,
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
      institution: institutionData,
    });
  } catch (error) {
    console.error('Error exchanging token:', error);
    return Response.json(
      { error: 'Failed to exchange token' },
      { status: 500 }
    );
  }
}
