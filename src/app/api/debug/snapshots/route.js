import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireVerifiedUserId } from '../../../../lib/api/auth';

export async function GET(request) {
  try {
    const userId = requireVerifiedUserId(request);

    // Get all accounts for the user
    const { data: accounts, error: accountsError } = await supabaseAdmin
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
    const { data: snapshots, error: snapshotsError } = await supabaseAdmin
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
    if (error instanceof Response) return error;
    console.error('Error in debug snapshots API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
