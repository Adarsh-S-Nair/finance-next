/**
 * Ensure the `tickers` table has logo rows for the securities referenced by an
 * item's investment transactions.
 *
 * Holdings sync only populates `tickers` for positions the user *currently*
 * holds, so a security you traded and later sold out of has no ticker row —
 * its transactions in the feed then fall back to the generic glyph instead of
 * the company/fund logo. This module backfills those.
 *
 * Logos come from logo.dev's ticker endpoint
 * (https://img.logo.dev/ticker/SYMBOL), which resolves by symbol and — unlike
 * the domain-based path holdings sync uses — also covers ETFs and money-market
 * funds. We validate each symbol with `fallback=404` so we only store URLs
 * that actually resolve (cash-sweep pseudo-tickers 404 and are skipped).
 *
 * Best-effort by design: logo enrichment must never fail the transaction sync,
 * so the orchestrator swallows and logs errors.
 */

import { supabaseAdmin } from '../../supabase/admin';
import { createLogger } from '../../logger';
import type { ExistingTickerRow } from '../holdingsSync/types';
import type { SecuritiesMap } from './types';

const logger = createLogger('investment-transactions-sync:tickers');

// A plausible exchange ticker: 1–6 uppercase letters, optionally dotted
// (BRK.B). Filters out cash-sweep pseudo-tickers ("CUR:USD") and the name
// fallbacks Plaid uses when a security has no symbol.
const TICKER_RE = /^[A-Z]{1,6}(\.[A-Z]{1,2})?$/;

const LOGO_DEV_TICKER_BASE = 'https://img.logo.dev/ticker';
const LOGO_RESOLVE_TIMEOUT_MS = 4000;

export interface InvestmentTickerCandidate {
  symbol: string;
  name: string | null;
  assetType: 'stock' | 'cash';
}

/**
 * Pure: pick the ticker candidates worth enriching from the securities map.
 * Any symbol that looks like a real ticker is a candidate — logo.dev decides
 * (via validation) whether a logo actually exists. Exported for unit testing.
 */
export function selectInvestmentTickerCandidates(
  securitiesMap: SecuritiesMap,
): InvestmentTickerCandidate[] {
  const bySymbol = new Map<string, InvestmentTickerCandidate>();
  for (const sec of securitiesMap.values()) {
    const symbol = sec.ticker?.trim().toUpperCase();
    if (!symbol || !TICKER_RE.test(symbol)) continue;
    if (bySymbol.has(symbol)) continue;
    bySymbol.set(symbol, {
      symbol,
      name: sec.name?.trim() || null,
      assetType: (sec.type || '').toLowerCase() === 'cash' ? 'cash' : 'stock',
    });
  }
  return Array.from(bySymbol.values());
}

function tickerLogoUrl(symbol: string, token: string): string {
  return `${LOGO_DEV_TICKER_BASE}/${encodeURIComponent(symbol)}?token=${token}`;
}

/**
 * Return the logo URL for a symbol if logo.dev actually has one, else null.
 * `fallback=404` makes logo.dev 404 instead of serving a generic monogram, so
 * we never persist a logo URL for a symbol with no real brand image.
 */
async function resolveTickerLogo(symbol: string, token: string): Promise<string | null> {
  const url = tickerLogoUrl(symbol, token);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOGO_RESOLVE_TIMEOUT_MS);
    const res = await fetch(`${url}&fallback=404`, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return res.ok ? url : null;
  } catch {
    return null;
  }
}

export async function ensureInvestmentTickers(securitiesMap: SecuritiesMap): Promise<void> {
  try {
    const token = process.env.LOGO_DEV_PUBLIC_KEY;
    if (!token) return;

    const candidates = selectInvestmentTickerCandidates(securitiesMap);
    if (candidates.length === 0) return;

    const { data: existingRows } = await supabaseAdmin
      .from('tickers')
      .select('symbol, name, sector, logo, asset_type')
      .in(
        'symbol',
        candidates.map((c) => c.symbol),
      );

    const existingMap = new Map<string, ExistingTickerRow>(
      (existingRows ?? []).map((r) => [r.symbol, r as ExistingTickerRow]),
    );

    // Skip symbols we already have a logo for; only resolve the rest.
    const needed = candidates.filter((c) => {
      const row = existingMap.get(c.symbol);
      return !row || !row.logo || row.logo.trim() === '';
    });
    if (needed.length === 0) return;

    const resolved = await Promise.all(
      needed.map(async (c) => ({ candidate: c, logo: await resolveTickerLogo(c.symbol, token) })),
    );

    // Build upsert rows only for symbols with a real logo. Preserve any
    // existing name/sector/asset_type (set by holdings sync) and only fill the
    // logo, so we never clobber richer holdings metadata.
    const inserts = resolved
      .filter((r): r is { candidate: InvestmentTickerCandidate; logo: string } => r.logo !== null)
      .map(({ candidate, logo }) => {
        const existing = existingMap.get(candidate.symbol);
        return {
          symbol: candidate.symbol,
          name: existing?.name ?? candidate.name,
          sector: existing?.sector ?? null,
          logo,
          asset_type: (existing?.asset_type ?? candidate.assetType) as 'stock' | 'cash',
        };
      });

    if (inserts.length === 0) return;

    const { error } = await supabaseAdmin
      .from('tickers')
      .upsert(inserts, { onConflict: 'symbol', ignoreDuplicates: false });

    if (error) {
      logger.warn('Failed to upsert investment tickers', { error: error.message });
      return;
    }

    logger.info('Investment tickers enriched', {
      count: inserts.length,
      tickers: inserts.map((i) => i.symbol),
    });
  } catch (err) {
    logger.warn('Ticker enrichment failed (non-fatal)', { error: (err as Error).message });
  }
}
