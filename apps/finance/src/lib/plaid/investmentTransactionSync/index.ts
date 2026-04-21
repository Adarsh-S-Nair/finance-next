/**
 * Investment transaction sync orchestrator.
 *
 * This is the single entry point that every caller should use:
 *   - The `/api/plaid/investments/transactions/sync` route (via a thin wrapper)
 *   - The Plaid INVESTMENTS_TRANSACTIONS webhook handler
 *   - The various multi-step "sync everything" routes (sync-all, exchange-token,
 *     manual-sync)
 *
 * Pattern: routes are thin (parse + dispatch + format response). Business
 * logic lives here. See `docs/architectural_patterns.md`.
 *
 * Wire-shape contract: this function returns the exact same fields the legacy
 * route did — `{ success: true, transactions_synced: N }`, or when the item
 * has no investment accounts, `{ success: true, transactions_synced: 0,
 * message: 'No investment accounts found' }`. Internal callers depend on
 * these exact field names.
 */

import { getInvestmentTransactions } from '../client';
import { supabaseAdmin } from '../../supabase/admin';
import { createLogger } from '../../logger';

import { buildInvestmentTransactionRows, buildSecuritiesMap } from './buildRows';
import type {
  AccountMap,
  InvestmentSyncResult,
  PlaidInvestmentTransaction,
  PlaidSecurity,
  SecuritiesMap,
} from './types';

const logger = createLogger('investment-transactions-sync');

// Number of years of history to fetch. Matches Plaid's docs (24 months) and
// the legacy route.
const LOOKBACK_YEARS = 2;

// Plaid's max page size for investmentsTransactionsGet.
const PAGE_SIZE = 500;

// Hard cap to prevent runaway pagination loops, mirroring transactionSync.
const MAX_TRANSACTIONS_PER_SYNC = 50_000;

export interface SyncParams {
  plaidItemId: string;
  userId: string;
  // Accepted for API parity with the legacy route. Currently unused — the
  // Plaid investmentsTransactionsGet endpoint doesn't have a "force" mode;
  // it's always an idempotent fetch-and-upsert.
  forceSync?: boolean;
}

/**
 * Sync investment transactions for a single Plaid item end-to-end.
 *
 * Throws on unrecoverable failures (attach `httpStatus` to the Error when
 * the caller should map to a specific HTTP status). On success returns the
 * shape the legacy route returned.
 */
export async function syncInvestmentTransactionsForItem(
  params: SyncParams
): Promise<InvestmentSyncResult> {
  const { plaidItemId, userId, forceSync = false } = params;

  logger.info('Investment transactions sync request received', {
    plaidItemId,
    userId,
    forceSync,
  });

  try {
    const plaidItem = await loadPlaidItem(plaidItemId, userId);
    logger.info('Plaid item found', { item_id: plaidItem.item_id });

    const accounts = await loadInvestmentAccounts(plaidItemId);
    if (accounts.length === 0) {
      logger.info('No investment accounts found for this plaid item', { plaidItemId });
      await logger.flush();
      return {
        success: true,
        transactions_synced: 0,
        message: 'No investment accounts found',
      };
    }

    logger.info('Found investment accounts', {
      plaidItemId,
      count: accounts.length,
    });

    const accountMap = buildAccountMap(accounts);

    // --- Fetch from Plaid (paginated) ---
    const { transactions, securities } = await fetchAllInvestmentTransactions(
      plaidItem.access_token,
      accounts.map((a) => a.account_id)
    );

    logger.info('Total investment transactions received', { count: transactions.length });

    // --- Build row plan (pure) ---
    const securitiesMap = buildSecuritiesMap(securities);
    const { rows, skippedCount } = buildInvestmentTransactionRows(
      transactions,
      accountMap,
      securitiesMap
    );

    if (skippedCount > 0) {
      logger.warn('Skipped investment transactions with unknown account', {
        plaidItemId,
        skippedCount,
      });
    }

    // --- Upsert rows ---
    if (rows.length > 0) {
      const { error: upsertError } = await supabaseAdmin
        .from('transactions')
        .upsert(rows, { onConflict: 'plaid_transaction_id' });

      if (upsertError) {
        logger.error('Failed to upsert investment transactions', null, {
          error: upsertError.message,
          code: upsertError.code,
          plaidItemId,
        });
        throw new Error(`Failed to upsert investment transactions: ${upsertError.message}`);
      }

      logger.info('Investment transactions upserted successfully', { count: rows.length });
    }

    logger.info('Investment transactions sync completed', {
      transactions_synced: rows.length,
    });
    await logger.flush();

    return {
      success: true,
      transactions_synced: rows.length,
    };
  } catch (error) {
    const err = error as Error;
    logger.error('Error syncing investment transactions', err, { plaidItemId });
    await logger.flush();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// IO helpers — private to the module.
// ---------------------------------------------------------------------------

interface PlaidItemRow {
  id: string;
  item_id: string;
  user_id: string;
  access_token: string;
}

async function loadPlaidItem(plaidItemId: string, userId: string): Promise<PlaidItemRow> {
  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select('id, item_id, user_id, access_token')
    .eq('id', plaidItemId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    logger.error('Plaid item not found', null, { plaidItemId, userId });
    throw Object.assign(new Error('Plaid item not found'), { httpStatus: 404 });
  }
  return data as PlaidItemRow;
}

interface AccountRow {
  id: string;
  account_id: string;
  type: string | null;
}

async function loadInvestmentAccounts(plaidItemId: string): Promise<AccountRow[]> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('id, account_id, type')
    .eq('plaid_item_id', plaidItemId)
    .eq('type', 'investment');

  if (error) {
    throw new Error(`Failed to fetch investment accounts: ${error.message}`);
  }
  return (data ?? []) as AccountRow[];
}

function buildAccountMap(accounts: AccountRow[]): AccountMap {
  const map: AccountMap = {};
  for (const row of accounts) {
    map[row.account_id] = row.id;
  }
  return map;
}

/**
 * Fetch all investment transactions for the given accounts, handling Plaid's
 * offset-based pagination. Also collects the securities list from the first
 * page (Plaid returns the same securities on every page).
 */
async function fetchAllInvestmentTransactions(
  accessToken: string,
  accountIds: string[]
): Promise<{ transactions: PlaidInvestmentTransaction[]; securities: PlaidSecurity[] }> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(endDate.getFullYear() - LOOKBACK_YEARS);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  logger.info('Fetching investment transactions', { startDateStr, endDateStr });

  const allTransactions: PlaidInvestmentTransaction[] = [];
  let securities: PlaidSecurity[] = [];
  let offset = 0;
  let totalExpected: number | null = null;

  while (true) {
    let responseData;
    try {
      responseData = (await getInvestmentTransactions(
        accessToken,
        startDateStr,
        endDateStr,
        accountIds,
        { count: PAGE_SIZE, offset }
      )) as {
        investment_transactions?: PlaidInvestmentTransaction[];
        total_investment_transactions?: number;
        securities?: PlaidSecurity[];
      };
    } catch (error) {
      const e = error as { response?: { data?: { error_message?: string } }; message?: string };
      throw new Error(
        `Plaid API error: ${e.response?.data?.error_message ?? e.message ?? 'unknown'}`
      );
    }

    const pageTxs = responseData.investment_transactions ?? [];
    const total = responseData.total_investment_transactions ?? 0;

    if (totalExpected === null) {
      totalExpected = total;
    }

    // Plaid returns the same securities list on every page. Capture it once.
    if (securities.length === 0 && responseData.securities?.length) {
      securities = responseData.securities;
    }

    allTransactions.push(...pageTxs);

    if (allTransactions.length >= MAX_TRANSACTIONS_PER_SYNC) {
      logger.warn('Hit MAX_TRANSACTIONS_PER_SYNC, stopping pagination', {
        count: allTransactions.length,
      });
      break;
    }

    // Done: we've fetched all the rows Plaid said existed, OR this page
    // was a partial page (less than PAGE_SIZE).
    if (totalExpected > 0 && allTransactions.length >= totalExpected) break;
    if (pageTxs.length < PAGE_SIZE) break;

    offset += PAGE_SIZE;
  }

  return { transactions: allTransactions, securities };
}

export type { InvestmentSyncResult } from './types';
