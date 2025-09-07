import { createLinkToken } from '../../../../lib/plaidClient';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    console.log('=== Plaid Link Token API Called ===');
    
    const { userId } = await request.json();
    console.log('User ID received:', userId);

    if (!userId) {
      console.log('Error: No user ID provided');
      return Response.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify user exists
    console.log('Verifying user exists...');
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      console.log('Error: User not found', userError);
      return Response.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    console.log('User verified, creating link token...');
    // Create link token
    const linkTokenResponse = await createLinkToken(userId);
    console.log('Link token created successfully');

    return Response.json({
      link_token: linkTokenResponse.link_token,
      expiration: linkTokenResponse.expiration,
    });
  } catch (error) {
    console.error('Error in link token API:', error);
    return Response.json(
      { error: error.message || 'Failed to create link token' },
      { status: 500 }
    );
  }
}
