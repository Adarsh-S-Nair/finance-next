import { supabaseAdmin } from './supabase/admin';
import type { Tables, TablesInsert } from '../types/database';

interface PlaidAccountBalances {
  available?: number | null;
  current?: number | null;
  limit?: number | null;
  iso_currency_code?: string | null;
}

interface PlaidAccountInput {
  balances?: PlaidAccountBalances | null;
}

type AccountSnapshotRow = Tables<'account_snapshots'>;
type AccountSnapshotInsert = TablesInsert<'account_snapshots'>;

interface OkResult<T> {
  success: true;
  data: T;
  reason?: string;
  skipped?: boolean;
}
interface ErrResult {
  success: false;
  error: string;
}
type Result<T> = OkResult<T> | ErrResult;

function buildSnapshot(
  account: PlaidAccountInput,
  accountId: string
): AccountSnapshotInsert {
  const balances = account.balances || {};
  return {
    account_id: accountId,
    available_balance: balances.available ?? null,
    current_balance: balances.current ?? null,
    limit_balance: balances.limit ?? null,
    currency_code: balances.iso_currency_code || 'USD',
    recorded_at: new Date().toISOString(),
  };
}

/**
 * Creates account snapshots for a list of accounts.
 */
export async function createAccountSnapshots(
  accounts: PlaidAccountInput[],
  accountIds: string[]
): Promise<Result<AccountSnapshotRow[]>> {
  try {
    if (!supabaseAdmin) {
      return { success: false, error: 'Supabase admin client not initialised' };
    }

    if (!accounts || !accountIds || accounts.length !== accountIds.length) {
      throw new Error(
        'Accounts and account IDs arrays must be provided and have the same length'
      );
    }

    const snapshotsToInsert = accounts.map((account, index) =>
      buildSnapshot(account, accountIds[index])
    );

    const { data, error } = await supabaseAdmin
      .from('account_snapshots')
      .insert(snapshotsToInsert)
      .select();

    if (error) {
      console.error('Error creating account snapshots:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Created ${data?.length ?? 0} account snapshots successfully`);
    return { success: true, data: data ?? [] };
  } catch (error) {
    console.error('Error in createAccountSnapshots:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Gets the most recent account snapshot for a given account.
 */
export async function getMostRecentAccountSnapshot(
  accountId: string
): Promise<AccountSnapshotRow | null> {
  if (!supabaseAdmin) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('account_snapshots')
      .select('*')
      .eq('account_id', accountId)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching most recent account snapshot:', error);
      return null;
    }

    return data ?? null;
  } catch (error) {
    console.error('Error in getMostRecentAccountSnapshot:', error);
    return null;
  }
}

interface ShouldCreateResult {
  shouldCreate: boolean;
  reason: string;
  isDateDifferent?: boolean;
  isBalanceDifferent?: boolean;
  currentDate?: string;
  mostRecentDate?: string;
  currentBalance?: number | null;
  mostRecentBalance?: number | null;
}

/**
 * Checks if a new account snapshot should be created based on date and balance conditions.
 */
export async function shouldCreateAccountSnapshot(
  account: PlaidAccountInput,
  accountId: string
): Promise<ShouldCreateResult> {
  try {
    const balances = account.balances || {};
    const currentDate = new Date().toISOString().split('T')[0];

    const mostRecentSnapshot = await getMostRecentAccountSnapshot(accountId);

    if (!mostRecentSnapshot) {
      return { shouldCreate: true, reason: 'No previous snapshot exists' };
    }

    const mostRecentDate = mostRecentSnapshot.recorded_at.split('T')[0];
    const isDateDifferent = currentDate !== mostRecentDate;

    const currentBalance = balances.current ?? null;
    const mostRecentBalance = mostRecentSnapshot.current_balance;
    const isBalanceDifferent = currentBalance !== mostRecentBalance;

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
      mostRecentBalance,
    };
  } catch (error) {
    console.error('Error in shouldCreateAccountSnapshot:', error);
    return {
      shouldCreate: false,
      reason: `Error checking conditions: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Creates a single account snapshot with conditional logic.
 */
export async function createAccountSnapshotConditional(
  account: PlaidAccountInput,
  accountId: string
): Promise<Result<AccountSnapshotRow | null>> {
  try {
    if (!supabaseAdmin) {
      return { success: false, error: 'Supabase admin client not initialised' };
    }

    const shouldCreateResult = await shouldCreateAccountSnapshot(account, accountId);

    if (!shouldCreateResult.shouldCreate) {
      console.log(
        `⏭️ Skipping account snapshot for account ${accountId}: ${shouldCreateResult.reason}`
      );
      return {
        success: true,
        skipped: true,
        reason: shouldCreateResult.reason,
        data: null,
      };
    }

    const { data, error } = await supabaseAdmin
      .from('account_snapshots')
      .insert(buildSnapshot(account, accountId))
      .select()
      .single();

    if (error) {
      console.error('Error creating account snapshot:', error);
      return { success: false, error: error.message };
    }

    console.log(
      `✅ Created account snapshot for account ${accountId}: ${shouldCreateResult.reason}`
    );
    return { success: true, data, reason: shouldCreateResult.reason };
  } catch (error) {
    console.error('Error in createAccountSnapshotConditional:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Creates a single account snapshot (original function for backward compatibility).
 */
export async function createAccountSnapshot(
  account: PlaidAccountInput,
  accountId: string
): Promise<Result<AccountSnapshotRow>> {
  try {
    if (!supabaseAdmin) {
      return { success: false, error: 'Supabase admin client not initialised' };
    }

    const { data, error } = await supabaseAdmin
      .from('account_snapshots')
      .insert(buildSnapshot(account, accountId))
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
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
