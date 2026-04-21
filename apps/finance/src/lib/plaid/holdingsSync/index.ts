/**
 * Holdings sync orchestrator.
 *
 * Single entry point for `/api/plaid/investments/holdings/sync`. Business
 * logic — quantity resolution, aggregation, classification, ticker planning
 * — lives in sibling pure modules and is unit-tested in isolation.
 *
 * This file contains only IO: Supabase reads/writes, Plaid API calls,
 * Finnhub + CoinGecko lookups. Each IO step is a small named helper so
 * the top-level flow reads as a linear story.
 *
 * See `docs/architectural_patterns.md`.
 */

import { getInvestmentsHoldings } from '../client';
import { supabaseAdmin } from '../../supabase/admin';
import { createLogger } from '../../logger';
// @ts-ignore — tierConfig is TS but not imported for typing
import { canAccess } from '../../tierConfig';
// fetchBulkTickerDetails is in a JS module that has no types.
import { fetchBulkTickerDetails } from '../../marketData';

import {
  buildSecurityMap,
  isLikelyEquityCompAccount,
  makeFallbackSecurityInfo,
} from './classify';
import {
  aggregateHoldingsByTicker,
  buildCashTickerInserts,
  buildCryptoTickerInserts,
  buildStockTickerInserts,
  planTickerProcessing,
  resolveHoldingAssetType,
  type PreparedHolding,
  type FinnhubTickerDetail,
} from './aggregate';
import { resolveHoldingQuantity, resolveHoldingValue } from './resolveHolding';
import { fetchBulkCryptoInfo } from './cryptoLogos';
import {
  HoldingsSyncError,
  type AggregatedHolding,
  type DbAccountRow,
  type ExistingTickerRow,
  type HoldingDebugEntry,
  type HoldingsSyncResult,
  type PlaidHolding,
  type PlaidInvestmentAccount,
  type PlaidSecurity,
  type SecurityInfo,
  type TickerUpsertRow,
} from './types';

const logger = createLogger('holdings-sync');

export interface SyncParams {
  plaidItemId: string;
  userId: string;
  forceSync?: boolean;
  includeDebug?: boolean;
}

/**
 * Sync holdings for a single Plaid item end-to-end.
 *
 * Throws `HoldingsSyncError` for HTTP-mappable failures (403 for tier
 * gate, 404 for missing item). Other errors propagate to the route
 * handler, which returns 500.
 */
export async function syncHoldingsForItem(
  params: SyncParams
): Promise<HoldingsSyncResult> {
  const { plaidItemId, userId, includeDebug = false } = params;

  logger.info('Holdings sync request received', { plaidItemId, userId, includeDebug });

  try {
    await ensureInvestmentsTierAccess(userId);
    const plaidItem = await loadPlaidItem(plaidItemId, userId);

    // --- Fetch from Plaid ---
    const { accounts, holdings, securities } = await fetchHoldings(plaidItem.access_token);

    logger.info('Holdings data received', {
      accounts_count: accounts?.length ?? 0,
      holdings_count: holdings?.length ?? 0,
      securities_count: securities?.length ?? 0,
    });

    const securityMap = buildSecurityMap(securities);
    const holdingsByPlaidAccount = groupHoldingsByAccount(holdings ?? []);

    // --- Per-account processing ---
    let totalHoldingsSynced = 0;
    const debugSummary: HoldingDebugEntry[] = [];

    for (const [plaidAccountId, accountHoldings] of holdingsByPlaidAccount) {
      const account = await loadInvestmentAccount(plaidAccountId, userId);
      if (!account) continue;

      const result = await syncSingleAccount({
        dbAccount: account,
        holdings: accountHoldings,
        securityMap,
        includeDebug,
      });

      totalHoldingsSynced += result.holdingsSynced;
      if (result.debugEntry) debugSummary.push(result.debugEntry);
    }

    logger.info('Holdings sync completed', { holdings_synced: totalHoldingsSynced });
    await logger.flush();

    const out: HoldingsSyncResult = {
      success: true,
      holdings_synced: totalHoldingsSynced,
    };
    if (includeDebug) {
      out.plaid_accounts_count = accounts?.length ?? 0;
      out.plaid_holdings_count = holdings?.length ?? 0;
      out.holdings_debug = debugSummary;
    }
    return out;
  } catch (error) {
    const err = error as Error;
    logger.error('Error syncing holdings', err, {
      plaidItemId,
      errorMessage: err.message,
    });
    await logger.flush();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Tier gating + item loading
// ---------------------------------------------------------------------------

async function ensureInvestmentsTierAccess(userId: string): Promise<void> {
  const { data: userProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle();

  const tier = (userProfile as { subscription_tier?: string } | null)?.subscription_tier || 'free';
  if (!canAccess(tier, 'investments')) {
    throw new HoldingsSyncError('feature_locked', 403, {
      code: 'feature_locked',
      feature: 'investments',
    });
  }
}

interface PlaidItemRow {
  id: string;
  user_id: string;
  item_id: string;
  access_token: string;
}

async function loadPlaidItem(plaidItemId: string, userId: string): Promise<PlaidItemRow> {
  const { data, error } = await supabaseAdmin
    .from('plaid_items')
    .select('*')
    .eq('id', plaidItemId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    logger.error('Plaid item not found', null, { plaidItemId, userId });
    throw new HoldingsSyncError('Plaid item not found', 404);
  }
  return data as PlaidItemRow;
}

// ---------------------------------------------------------------------------
// Plaid fetch + grouping
// ---------------------------------------------------------------------------

interface PlaidHoldingsResponse {
  accounts?: PlaidInvestmentAccount[];
  holdings?: PlaidHolding[];
  securities?: PlaidSecurity[];
}

async function fetchHoldings(accessToken: string): Promise<PlaidHoldingsResponse> {
  const res = (await getInvestmentsHoldings(accessToken)) as unknown as PlaidHoldingsResponse;
  return res;
}

function groupHoldingsByAccount(
  holdings: PlaidHolding[]
): Map<string, PlaidHolding[]> {
  const map = new Map<string, PlaidHolding[]>();
  for (const h of holdings) {
    const existing = map.get(h.account_id);
    if (existing) existing.push(h);
    else map.set(h.account_id, [h]);
  }
  return map;
}

async function loadInvestmentAccount(
  plaidAccountId: string,
  userId: string
): Promise<DbAccountRow | null> {
  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select('*')
    .eq('account_id', plaidAccountId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    logger.warn('Account not found for holdings', { plaid_account_id: plaidAccountId });
    return null;
  }

  const row = data as DbAccountRow;
  if (row.type !== 'investment') {
    logger.debug?.('Skipping non-investment account', { plaid_account_id: plaidAccountId });
    return null;
  }
  return row;
}

// ---------------------------------------------------------------------------
// Per-account sync
// ---------------------------------------------------------------------------

interface SingleAccountSyncInput {
  dbAccount: DbAccountRow;
  holdings: PlaidHolding[];
  securityMap: Map<string, SecurityInfo>;
  includeDebug: boolean;
}

interface SingleAccountSyncResult {
  holdingsSynced: number;
  debugEntry: HoldingDebugEntry | null;
}

async function syncSingleAccount(
  input: SingleAccountSyncInput
): Promise<SingleAccountSyncResult> {
  const { dbAccount, holdings, securityMap, includeDebug } = input;

  const isEquityComp = isLikelyEquityCompAccount(dbAccount);
  const debugEntry: HoldingDebugEntry | null = includeDebug
    ? {
        account_id: dbAccount.account_id,
        account_name: dbAccount.name,
        account_subtype: dbAccount.subtype,
        likely_equity_comp_account: isEquityComp,
        holdings: [],
      }
    : null;

  // Prepare per-holding rows and track which tickers are crypto/cash.
  const prepared: PreparedHolding[] = [];
  const cryptoTickerSet = new Set<string>();
  const cashTickerSet = new Set<string>();
  const tickerSecurityInfo = new Map<string, SecurityInfo>();
  let totalHoldingsValue = 0;
  let cashFromHoldings = 0;

  for (const holding of holdings) {
    const security =
      securityMap.get(holding.security_id) ?? makeFallbackSecurityInfo(holding.security_id);

    const ticker = (security.ticker || holding.security_id).toUpperCase();
    const { securityInfo: classified, assetType, isCashHolding } = resolveHoldingAssetType(
      ticker,
      security
    );

    const resolvedQty = resolveHoldingQuantity(holding, isEquityComp);
    const resolvedVal = resolveHoldingValue(holding, resolvedQty);

    if (classified.isCrypto) cryptoTickerSet.add(ticker);
    else if (isCashHolding) cashTickerSet.add(ticker);
    tickerSecurityInfo.set(ticker, classified);

    totalHoldingsValue += resolvedVal.institutionValue;
    if (isCashHolding) cashFromHoldings += resolvedVal.institutionValue;

    prepared.push({
      ticker,
      quantity: resolvedQty.quantity,
      costBasis: resolvedVal.costBasis,
      institutionValue: resolvedVal.institutionValue,
      assetType,
    });

    if (debugEntry) {
      debugEntry.holdings.push({
        ticker,
        security_id: holding.security_id,
        quantity: resolvedQty.rawQuantity,
        vested_quantity: resolvedQty.rawVestedQuantity,
        unvested_quantity: resolvedQty.rawUnvestedQuantity,
        institution_value: resolvedVal.totalInstitutionValue,
        vested_value: holding.vested_value != null ? Number(holding.vested_value) : null,
        synced_quantity: resolvedQty.quantity,
        synced_value: resolvedVal.institutionValue,
        quantity_reason: resolvedQty.reason,
      });
    }
  }

  // Aggregate by ticker.
  const aggregated = aggregateHoldingsByTicker(prepared, dbAccount.id);

  // Ensure tickers exist in the DB with full metadata.
  await ensureTickers({
    aggregated,
    cryptoTickerSet,
    cashTickerSet,
    tickerSecurityInfo,
  });

  // Replace holdings for this account (delete + insert).
  const nonZero = aggregated.filter((h) => h.shares > 0);
  const insertedCount = await replaceAccountHoldings(dbAccount.id, nonZero);

  if (debugEntry) debugEntry.non_zero_holdings_inserted = insertedCount;

  // Keep `accounts.balances.current` in sync with the aggregated total.
  await updateAccountBalances(dbAccount.id, totalHoldingsValue, cashFromHoldings);

  // Write today's account snapshot.
  await writeTodaySnapshot(dbAccount.id, totalHoldingsValue, cashFromHoldings);

  return { holdingsSynced: insertedCount, debugEntry };
}

// ---------------------------------------------------------------------------
// Ticker ensuring
// ---------------------------------------------------------------------------

interface EnsureTickersInput {
  aggregated: AggregatedHolding[];
  cryptoTickerSet: Set<string>;
  cashTickerSet: Set<string>;
  tickerSecurityInfo: Map<string, SecurityInfo>;
}

async function ensureTickers(input: EnsureTickersInput): Promise<void> {
  const { aggregated, cryptoTickerSet, cashTickerSet, tickerSecurityInfo } = input;
  const uniqueTickers = Array.from(new Set(aggregated.map((h) => h.ticker)));
  if (uniqueTickers.length === 0) return;

  const { data: existingRows, error: fetchError } = await supabaseAdmin
    .from('tickers')
    .select('symbol, name, sector, logo, asset_type')
    .in('symbol', uniqueTickers);

  if (fetchError) {
    logger.warn('Error checking existing tickers', { error: fetchError.message });
  }

  const existingTickers = (existingRows ?? []) as ExistingTickerRow[];
  const plan = planTickerProcessing(uniqueTickers, existingTickers, cryptoTickerSet, cashTickerSet);

  const allInserts: TickerUpsertRow[] = [];

  // Stocks: Finnhub
  if (plan.stockTickers.length > 0) {
    logger.info('Processing stock tickers', {
      count: plan.stockTickers.length,
      tickers: plan.stockTickers,
    });
    const details = (await fetchBulkTickerDetails(plan.stockTickers, 250)) as FinnhubTickerDetail[];
    allInserts.push(
      ...buildStockTickerInserts(
        plan.stockTickers,
        plan.existingTickerMap,
        details,
        process.env.LOGO_DEV_PUBLIC_KEY
      )
    );
  }

  // Crypto: CoinGecko
  if (plan.cryptoTickers.length > 0) {
    logger.info('Processing crypto tickers', {
      count: plan.cryptoTickers.length,
      tickers: plan.cryptoTickers,
    });
    const needsLogo = plan.cryptoTickers.filter((t) => {
      const row = plan.existingTickerMap.get(t);
      return !row?.logo || row.logo.trim() === '';
    });
    const coinGecko =
      needsLogo.length > 0 ? await fetchBulkCryptoInfo(needsLogo) : new Map();
    allInserts.push(
      ...buildCryptoTickerInserts(
        plan.cryptoTickers,
        plan.existingTickerMap,
        coinGecko,
        tickerSecurityInfo
      )
    );
  }

  // Cash: use Plaid's security info
  if (plan.cashTickers.length > 0) {
    logger.info('Processing cash tickers', {
      count: plan.cashTickers.length,
      tickers: plan.cashTickers,
    });
    allInserts.push(
      ...buildCashTickerInserts(plan.cashTickers, plan.existingTickerMap, tickerSecurityInfo)
    );
  }

  if (allInserts.length === 0) return;

  const { error: upsertError } = await supabaseAdmin
    .from('tickers')
    .upsert(allInserts, { onConflict: 'symbol', ignoreDuplicates: false });

  if (upsertError) {
    logger.error('Error upserting tickers', null, { error: upsertError.message });
    return;
  }

  logger.info('Tickers upserted', {
    total: allInserts.length,
    stocks: allInserts.filter((t) => t.asset_type === 'stock').length,
    crypto: allInserts.filter((t) => t.asset_type === 'crypto').length,
    cash: allInserts.filter((t) => t.asset_type === 'cash').length,
  });
}

// ---------------------------------------------------------------------------
// Holdings replacement
// ---------------------------------------------------------------------------

async function replaceAccountHoldings(
  dbAccountId: string,
  nonZero: AggregatedHolding[]
): Promise<number> {
  const { error: deleteError } = await supabaseAdmin
    .from('holdings')
    .delete()
    .eq('account_id', dbAccountId);

  if (deleteError) {
    logger.error('Error deleting old holdings', null, {
      account_id: dbAccountId,
      error: deleteError.message,
    });
    return 0;
  }

  if (nonZero.length === 0) return 0;

  const { error: insertError } = await supabaseAdmin.from('holdings').insert(nonZero);
  if (insertError) {
    logger.error('Error inserting holdings', null, {
      account_id: dbAccountId,
      count: nonZero.length,
      error: insertError.message,
    });
    return 0;
  }

  return nonZero.length;
}

// ---------------------------------------------------------------------------
// Balance + snapshot writes
// ---------------------------------------------------------------------------

async function updateAccountBalances(
  dbAccountId: string,
  totalValue: number,
  cashValue: number
): Promise<void> {
  try {
    const { data: accountRow } = await supabaseAdmin
      .from('accounts')
      .select('balances')
      .eq('id', dbAccountId)
      .single();

    const existingBalances = ((accountRow as { balances?: Record<string, unknown> } | null)
      ?.balances) ?? {};
    const mergedBalances = {
      ...existingBalances,
      current: totalValue,
      available: cashValue,
    };

    await supabaseAdmin
      .from('accounts')
      .update({ balances: mergedBalances })
      .eq('id', dbAccountId);
  } catch (err) {
    logger.warn('Exception updating account balance from holdings', {
      account_id: dbAccountId,
      error: (err as Error).message,
    });
  }
}

async function writeTodaySnapshot(
  dbAccountId: string,
  totalValue: number,
  cashValue: number
): Promise<void> {
  // The unique index is on (account_id, UTC day), but PostgREST can't
  // target expression indexes — so we manually delete today's row and
  // insert a fresh one to keep writes idempotent within the day.
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);

    await supabaseAdmin
      .from('account_snapshots')
      .delete()
      .eq('account_id', dbAccountId)
      .gte('recorded_at', todayStart.toISOString())
      .lt('recorded_at', tomorrowStart.toISOString());

    await supabaseAdmin.from('account_snapshots').insert({
      account_id: dbAccountId,
      account_type: 'investment',
      current_balance: totalValue,
      available_balance: cashValue,
      limit_balance: null,
      currency_code: 'USD',
      recorded_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn('Exception writing account snapshot from holdings', {
      account_id: dbAccountId,
      error: (err as Error).message,
    });
  }
}
