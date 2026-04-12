/**
 * Pure aggregation and planning for the holdings sync pipeline.
 *
 * Given the already-resolved per-holding values, this module decides:
 *   - How to aggregate multiple Plaid holdings of the same ticker into
 *     a single row (weighted-average cost basis).
 *   - Which tickers are new to our `tickers` table vs. which are already
 *     present but missing data (name/sector/logo/wrong asset_type).
 *   - How to build the final ticker upsert rows from Finnhub + CoinGecko
 *     lookups.
 *
 * No IO. Every function is deterministic given its inputs.
 */

import {
  isKnownCryptoTicker,
  isLegacyCashTicker,
} from './classify';
import type {
  AggregatedHolding,
  AssetType,
  ExistingTickerRow,
  SecurityInfo,
  TickerUpsertRow,
} from './types';

// ---------------------------------------------------------------------------
// Per-holding → aggregated row
// ---------------------------------------------------------------------------

/**
 * A partially-resolved holding ready to be folded into the aggregation.
 * The orchestrator builds these from the raw Plaid holding + its
 * resolved quantity/value.
 */
export interface PreparedHolding {
  ticker: string;
  quantity: number;
  costBasis: number;
  institutionValue: number;
  assetType: AssetType;
}

/**
 * Classify a single holding's asset type, honoring Plaid's security type
 * and falling back to known crypto symbols and the legacy `CUR:` cash
 * marker.
 *
 * Returns the potentially-updated SecurityInfo (may flip to crypto/cash)
 * along with the resolved AssetType. Used by the orchestrator when
 * building PreparedHolding rows.
 */
export function resolveHoldingAssetType(
  ticker: string,
  securityInfo: SecurityInfo
): { securityInfo: SecurityInfo; assetType: AssetType; isCashHolding: boolean } {
  const tickerUpper = ticker.toUpperCase();

  // Fallback: Plaid misclassified as equity but we know it's crypto.
  let info = securityInfo;
  if (!info.isCrypto && isKnownCryptoTicker(tickerUpper)) {
    info = { ...info, isCrypto: true, assetType: 'crypto' };
  }

  const isLegacyCash = isLegacyCashTicker(tickerUpper);
  const isCashHolding = info.isCash || isLegacyCash;

  let assetType: AssetType = 'stock';
  if (info.isCrypto) assetType = 'crypto';
  else if (isCashHolding) assetType = 'cash';

  if (isLegacyCash && !info.isCash) {
    info = { ...info, isCash: true, assetType: 'cash' };
  }

  return { securityInfo: info, assetType, isCashHolding };
}

/**
 * Aggregate a batch of PreparedHolding rows (all for the same DB
 * account) into one row per ticker, using a weighted-average cost
 * basis. Matches legacy semantics exactly.
 *
 * Algorithm:
 *   - First occurrence of a ticker: shares = qty, avg_cost = cost/qty.
 *   - Subsequent occurrences: shares += qty, avg_cost = (existing_avg *
 *     existing_shares + new_cost) / total_shares.
 *
 * Note: the legacy code's second-branch formula is
 *   (existing.avg_cost * existing.shares) + costBasis
 * which is a dollar total, not a weighted average of avg_costs. Preserved
 * verbatim.
 */
export function aggregateHoldingsByTicker(
  holdings: PreparedHolding[],
  dbAccountId: string
): AggregatedHolding[] {
  const byTicker = new Map<string, AggregatedHolding>();

  for (const h of holdings) {
    const existing = byTicker.get(h.ticker);
    if (!existing) {
      const avgCost = h.quantity > 0 ? h.costBasis / h.quantity : 0;
      byTicker.set(h.ticker, {
        account_id: dbAccountId,
        ticker: h.ticker,
        shares: h.quantity,
        avg_cost: avgCost,
        asset_type: h.assetType,
      });
      continue;
    }

    const totalShares = existing.shares + h.quantity;
    const totalCostBasis = existing.avg_cost * existing.shares + h.costBasis;
    byTicker.set(h.ticker, {
      account_id: dbAccountId,
      ticker: h.ticker,
      shares: totalShares,
      avg_cost: totalShares > 0 ? totalCostBasis / totalShares : 0,
      asset_type: h.assetType,
    });
  }

  return Array.from(byTicker.values());
}

// ---------------------------------------------------------------------------
// Ticker processing diff
// ---------------------------------------------------------------------------

export interface TickerProcessingPlan {
  /** Tickers that need full processing (new or missing data / wrong asset_type) */
  stockTickers: string[];
  cryptoTickers: string[];
  cashTickers: string[];
  /** Lookup map for existing rows (by symbol) — for preserving fields */
  existingTickerMap: Map<string, ExistingTickerRow>;
}

/**
 * Decide which tickers need their details (re-)fetched and upserted.
 *
 * A ticker needs processing if it's:
 *   - Not yet in the `tickers` table at all, OR
 *   - Present but missing name, sector, or logo, OR
 *   - Present with the wrong asset_type (e.g. a crypto that was
 *     previously stored as a stock).
 */
export function planTickerProcessing(
  uniqueTickers: string[],
  existingTickers: ExistingTickerRow[],
  cryptoTickerSet: ReadonlySet<string>,
  cashTickerSet: ReadonlySet<string>
): TickerProcessingPlan {
  const existingTickerMap = new Map<string, ExistingTickerRow>();
  for (const row of existingTickers) {
    existingTickerMap.set(row.symbol, row);
  }
  const existingSymbols = new Set(existingTickerMap.keys());

  const newTickers = uniqueTickers.filter((t) => !existingSymbols.has(t));

  const existingNeedingRefresh = existingTickers
    .filter((row) => {
      const hasName = Boolean(row.name && row.name.trim() !== '');
      const hasSector = Boolean(row.sector && row.sector.trim() !== '');
      const hasLogo = Boolean(row.logo && row.logo.trim() !== '');

      let correctAssetType: AssetType = 'stock';
      if (cryptoTickerSet.has(row.symbol)) correctAssetType = 'crypto';
      else if (cashTickerSet.has(row.symbol)) correctAssetType = 'cash';
      const assetTypeOk = row.asset_type === correctAssetType;

      return !hasName || !hasSector || !hasLogo || !assetTypeOk;
    })
    .map((row) => row.symbol);

  const toProcess = Array.from(new Set([...newTickers, ...existingNeedingRefresh]));

  const stockTickers = toProcess.filter(
    (t) => !cryptoTickerSet.has(t) && !cashTickerSet.has(t)
  );
  const cryptoTickers = toProcess.filter((t) => cryptoTickerSet.has(t));
  const cashTickers = toProcess.filter((t) => cashTickerSet.has(t));

  return { stockTickers, cryptoTickers, cashTickers, existingTickerMap };
}

// ---------------------------------------------------------------------------
// Ticker upsert row builders
// ---------------------------------------------------------------------------

/** Prefer the existing DB value if it's non-empty, otherwise the incoming one. */
function preferNonEmpty<T extends string | null>(existing: T | undefined, incoming: T): T {
  if (existing && typeof existing === 'string' && existing.trim() !== '') return existing;
  return incoming;
}

export interface FinnhubTickerDetail {
  ticker: string;
  name?: string | null;
  sector?: string | null;
  domain?: string | null;
}

export function buildStockTickerInserts(
  stockTickers: string[],
  existingTickerMap: Map<string, ExistingTickerRow>,
  finnhubDetails: FinnhubTickerDetail[],
  logoDevPublicKey: string | undefined | null
): TickerUpsertRow[] {
  const inserts: TickerUpsertRow[] = [];
  const wantedSet = new Set(stockTickers);

  for (const detail of finnhubDetails) {
    const symbol = detail.ticker.toUpperCase();
    if (!wantedSet.has(symbol)) continue;

    const existing = existingTickerMap.get(symbol);
    const name = preferNonEmpty<string | null>(existing?.name, detail.name ?? null);
    const sector = preferNonEmpty<string | null>(existing?.sector, detail.sector ?? null);

    let logo: string | null;
    if (existing?.logo && existing.logo.trim() !== '') {
      logo = existing.logo;
    } else if (detail.domain && logoDevPublicKey) {
      logo = `https://img.logo.dev/${detail.domain}?token=${logoDevPublicKey}`;
    } else {
      logo = null;
    }

    inserts.push({ symbol, name, sector, logo, asset_type: 'stock' });
  }

  return inserts;
}

export interface CoinGeckoTickerInfo {
  logo: string | null;
  name: string | null;
}

export function buildCryptoTickerInserts(
  cryptoTickers: string[],
  existingTickerMap: Map<string, ExistingTickerRow>,
  coinGeckoInfo: Map<string, CoinGeckoTickerInfo>,
  tickerSecurityInfo: Map<string, SecurityInfo>
): TickerUpsertRow[] {
  const inserts: TickerUpsertRow[] = [];

  for (const ticker of cryptoTickers) {
    const existing = existingTickerMap.get(ticker);
    const securityInfo = tickerSecurityInfo.get(ticker);
    const gecko = coinGeckoInfo.get(ticker.toUpperCase());

    const name = preferNonEmpty<string | null>(
      existing?.name,
      gecko?.name ?? securityInfo?.name ?? ticker
    );
    const sector = preferNonEmpty<string | null>(existing?.sector, 'Cryptocurrency');

    let logo: string | null;
    if (existing?.logo && existing.logo.trim() !== '') {
      logo = existing.logo;
    } else {
      logo = gecko?.logo ?? null;
    }

    inserts.push({ symbol: ticker, name, sector, logo, asset_type: 'crypto' });
  }

  return inserts;
}

export function buildCashTickerInserts(
  cashTickers: string[],
  existingTickerMap: Map<string, ExistingTickerRow>,
  tickerSecurityInfo: Map<string, SecurityInfo>
): TickerUpsertRow[] {
  const inserts: TickerUpsertRow[] = [];

  for (const ticker of cashTickers) {
    const existing = existingTickerMap.get(ticker);
    const securityInfo = tickerSecurityInfo.get(ticker);

    const name = preferNonEmpty<string | null>(existing?.name, securityInfo?.name ?? ticker);
    const sector = preferNonEmpty<string | null>(existing?.sector, 'Cash');
    const logo: string | null = existing?.logo && existing.logo.trim() !== '' ? existing.logo : null;

    inserts.push({ symbol: ticker, name, sector, logo, asset_type: 'cash' });
  }

  return inserts;
}
