import { supabaseAdmin } from './supabaseAdmin';

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

    const { data, error } = await supabaseAdmin
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
 * Gets the most recent account snapshot for a given account
 * @param {string} accountId - Database account ID
 * @returns {Promise<Object|null>} - Most recent snapshot or null if none exists
 */
export async function getMostRecentAccountSnapshot(accountId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('account_snapshots')
      .select('*')
      .eq('account_id', accountId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Error fetching most recent account snapshot:', error);
      return null;
    }

    return data || null;
  } catch (error) {
    console.error('Error in getMostRecentAccountSnapshot:', error);
    return null;
  }
}

/**
 * Checks if a new account snapshot should be created based on date and balance conditions
 * @param {Object} account - Account object with Plaid data
 * @param {string} accountId - Database account ID
 * @returns {Promise<Object>} - Result object with shouldCreate flag and reason
 */
export async function shouldCreateAccountSnapshot(account, accountId) {
  try {
    const balances = account.balances || {};
    const currentDate = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    // Get the most recent snapshot
    const mostRecentSnapshot = await getMostRecentAccountSnapshot(accountId);
    
    // If no previous snapshot exists, we should create one
    if (!mostRecentSnapshot) {
      return {
        shouldCreate: true,
        reason: 'No previous snapshot exists'
      };
    }
    
    // Check if the date is different
    const mostRecentDate = mostRecentSnapshot.recorded_at.split('T')[0];
    const isDateDifferent = currentDate !== mostRecentDate;
    
    // Check if the balance is different
    const currentBalance = balances.current || null;
    const mostRecentBalance = mostRecentSnapshot.current_balance;
    const isBalanceDifferent = currentBalance !== mostRecentBalance;
    
    // Both conditions must be met
    const shouldCreate = isDateDifferent && isBalanceDifferent;
    
    return {
      shouldCreate,
      reason: shouldCreate 
        ? `Date different (${currentDate} vs ${mostRecentDate}) and balance different (${currentBalance} vs ${mostRecentBalance})`
        : `Conditions not met - Date same: ${!isDateDifferent}, Balance same: ${!isBalanceDifferent}`,
      isDateDifferent,
      isBalanceDifferent,
      currentDate,
      mostRecentDate,
      currentBalance,
      mostRecentBalance
    };
  } catch (error) {
    console.error('Error in shouldCreateAccountSnapshot:', error);
    return {
      shouldCreate: false,
      reason: `Error checking conditions: ${error.message}`
    };
  }
}

/**
 * Creates a single account snapshot with conditional logic
 * @param {Object} account - Account object with Plaid data
 * @param {string} accountId - Database account ID
 * @returns {Promise<Object>} - Result object with success status and data/error
 */
export async function createAccountSnapshotConditional(account, accountId) {
  try {
    // Check if we should create a snapshot
    const shouldCreateResult = await shouldCreateAccountSnapshot(account, accountId);
    
    if (!shouldCreateResult.shouldCreate) {
      console.log(`⏭️ Skipping account snapshot for account ${accountId}: ${shouldCreateResult.reason}`);
      return {
        success: true,
        skipped: true,
        reason: shouldCreateResult.reason,
        data: null
      };
    }
    
    // Create the snapshot
    const balances = account.balances || {};
    
    const snapshotData = {
      account_id: accountId,
      available_balance: balances.available || null,
      current_balance: balances.current || null,
      limit_balance: balances.limit || null,
      currency_code: balances.iso_currency_code || 'USD',
      recorded_at: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin
      .from('account_snapshots')
      .insert(snapshotData)
      .select()
      .single();

    if (error) {
      console.error('Error creating account snapshot:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Created account snapshot for account ${accountId}: ${shouldCreateResult.reason}`);
    return { success: true, data, reason: shouldCreateResult.reason };
  } catch (error) {
    console.error('Error in createAccountSnapshotConditional:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Creates a single account snapshot (original function for backward compatibility)
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

    const { data, error } = await supabaseAdmin
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
