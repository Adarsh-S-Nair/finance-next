import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Creates account snapshots for a list of accounts
 * @param {Array} accounts - Array of account objects with Plaid data
 * @param {Array} accountIds - Array of corresponding account IDs from the database
 * @returns {Promise<Object>} - Result object with success status and data/error
 */
export async function createAccountSnapshots(accounts, accountIds) {
  try {
    if (!accounts || !accountIds || accounts.length !== accountIds.length) {
      throw new Error('Accounts and account IDs arrays must be provided and have the same length');
    }

    const snapshotsToInsert = accounts.map((account, index) => {
      const accountId = accountIds[index];
      const balances = account.balances || {};
      
      return {
        account_id: accountId,
        available_balance: balances.available || null,
        current_balance: balances.current || null,
        limit_balance: balances.limit || null,
        currency_code: balances.iso_currency_code || 'USD',
        recorded_at: new Date().toISOString()
      };
    });

    const { data, error } = await supabase
      .from('account_snapshots')
      .insert(snapshotsToInsert)
      .select();

    if (error) {
      console.error('Error creating account snapshots:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Created ${data.length} account snapshots successfully`);
    return { success: true, data };
  } catch (error) {
    console.error('Error in createAccountSnapshots:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a single account snapshot
 * @param {Object} account - Account object with Plaid data
 * @param {string} accountId - Database account ID
 * @returns {Promise<Object>} - Result object with success status and data/error
 */
export async function createAccountSnapshot(account, accountId) {
  try {
    const balances = account.balances || {};
    
    const snapshotData = {
      account_id: accountId,
      available_balance: balances.available || null,
      current_balance: balances.current || null,
      limit_balance: balances.limit || null,
      currency_code: balances.iso_currency_code || 'USD',
      recorded_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('account_snapshots')
      .insert(snapshotData)
      .select()
      .single();

    if (error) {
      console.error('Error creating account snapshot:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Created account snapshot for account ${accountId}`);
    return { success: true, data };
  } catch (error) {
    console.error('Error in createAccountSnapshot:', error);
    return { success: false, error: error.message };
  }
}
