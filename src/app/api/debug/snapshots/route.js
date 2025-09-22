import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Get all accounts for the user
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, name, type, subtype')
      .eq('user_id', userId);

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError);
      return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
    }

    console.log(`🔍 Debug: Found ${accounts.length} accounts for user ${userId}`);

    if (accounts.length === 0) {
      return NextResponse.json({ 
        message: 'No accounts found for user',
        accounts: [],
        snapshots: []
      });
    }

    const accountIds = accounts.map(account => account.id);

    // Get all snapshots for these accounts
    const { data: snapshots, error: snapshotsError } = await supabase
      .from('account_snapshots')
      .select('*')
      .in('account_id', accountIds)
      .order('recorded_at', { ascending: false })
      .limit(20);

    if (snapshotsError) {
      console.error('Error fetching snapshots:', snapshotsError);
      return NextResponse.json({ error: 'Failed to fetch snapshots' }, { status: 500 });
    }

    console.log(`🔍 Debug: Found ${snapshots.length} snapshots`);

    return NextResponse.json({
      message: 'Debug data retrieved successfully',
      accounts: accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        type: acc.type,
        subtype: acc.subtype
      })),
      snapshots: snapshots.map(snap => ({
        id: snap.id,
        account_id: snap.account_id,
        current_balance: snap.current_balance,
        recorded_at: snap.recorded_at
      })),
      totalAccounts: accounts.length,
      totalSnapshots: snapshots.length
    });

  } catch (error) {
    console.error('Error in debug snapshots API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
