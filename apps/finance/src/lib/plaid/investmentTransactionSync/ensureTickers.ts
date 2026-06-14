/**
 * Ensure the `tickers` table has logo/name rows for the stock securities
 * referenced by an item's investment transactions.
 *
 * Holdings sync only populates `tickers` for positions the user *currently*
 * holds. A security you traded and later sold out of therefore has no ticker
 * row — so its transactions in the feed fall back to the generic glyph
 * instead of the company logo. This module backfills those, reusing the same
 * Finnhub → logo.dev enrichment holdings sync uses.
 *
 * Best-effort by design: logo enrichment must never fail the transaction sync,
 * so the orchestrator swallows and logs errors.
 */

import { supabaseAdmin } from '../../supabase/admin';
import { createLogger } from '../../logger';
import { fetchBulkTickerDetails } from '../../marketData';
import { buildStockTickerInserts, type FinnhubTickerDetail } from '../holdingsSync/aggregate';
import type { ExistingTickerRow } from '../holdingsSync/types';
import type { SecuritiesMap } from './types';

const logger = createLogger('investment-transactions-sync:tickers');

// Plaid security types that map to a logo-able equity. ETFs/mutual funds/cash
// rarely resolve a logo on logo.dev, and cash sweeps carry junk "tickers"
// (e.g. "CUR:USD"), so we only enrich individual equities.
const STOCK_SECURITY_TYPES = new Set(['equity']);

// A plausible exchange ticker: 1–6 uppercase letters, optionally dotted
// (BRK.B). Filters out cash-sweep pseudo-tickers and Plaid's name fallbacks.
const TICKER_RE = /^[A-Z]{1,6}(\.[A-Z]{1,2})?$/;

/**
 * Pure: pick the equity tickers worth enriching from the securities map.
 * Exported for unit testing.
 */
export function selectStockTickers(securitiesMap: SecuritiesMap): string[] {
  const out = new Set<string>();
  for (const sec of securitiesMap.values()) {
    const ticker = sec.ticker?.trim().toUpperCase();
    if (!ticker || !TICKER_RE.test(ticker)) continue;
    if (!STOCK_SECURITY_TYPES.has((sec.type || '').toLowerCase())) continue;
    out.add(ticker);
  }
  return Array.from(out);
}

export async function ensureInvestmentTickers(securitiesMap: SecuritiesMap): Promise<void> {
  try {
    const stockTickers = selectStockTickers(securitiesMap);
    if (stockTickers.length === 0) return;

    const { data: existingRows } = await supabaseAdmin
      .from('tickers')
      .select('symbol, name, sector, logo, asset_type')
      .in('symbol', stockTickers);

    const existingMap = new Map<string, ExistingTickerRow>(
      (existingRows ?? []).map((r) => [r.symbol, r as ExistingTickerRow]),
    );

    // Only hit Finnhub for tickers we don't have, or have but with no logo yet.
    const needed = stockTickers.filter((t) => {
      const row = existingMap.get(t);
      return !row || !row.logo || row.logo.trim() === '';
    });
    if (needed.length === 0) return;

    const details = (await fetchBulkTickerDetails(needed, 250)) as FinnhubTickerDetail[];
    const inserts = buildStockTickerInserts(
      needed,
      existingMap,
      details,
      process.env.LOGO_DEV_PUBLIC_KEY,
    );
    if (inserts.length === 0) return;

    const { error } = await supabaseAdmin
      .from('tickers')
      .upsert(inserts, { onConflict: 'symbol', ignoreDuplicates: false });

    if (error) {
      logger.warn('Failed to upsert investment tickers', { error: error.message });
      return;
    }

    logger.info('Investment tickers enriched', { count: inserts.length, tickers: needed });
  } catch (err) {
    logger.warn('Ticker enrichment failed (non-fatal)', { error: (err as Error).message });
  }
}
