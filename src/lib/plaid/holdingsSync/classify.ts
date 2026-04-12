/**
 * Pure classification helpers for the holdings sync pipeline.
 *
 * These decide "what kind of asset is this" — stock, crypto, or cash —
 * based on Plaid's security payload plus a fallback set of known crypto
 * tickers (since some brokers, notably Robinhood, return crypto as
 * 'equity' rather than 'cryptocurrency').
 *
 * No IO, no globals. Safe to unit test with literal inputs.
 */

import type {
  AssetType,
  DbAccountRow,
  PlaidSecurity,
  SecurityInfo,
} from './types';

/**
 * Known crypto ticker symbols used as a fallback when Plaid doesn't
 * correctly identify a security as `type: 'cryptocurrency'`.
 *
 * This is intentionally a conservative allowlist — we'd rather miss a
 * long-tail coin than misclassify a legitimate equity ticker. Add new
 * entries here as we encounter them.
 */
export const KNOWN_CRYPTO_TICKERS: ReadonlySet<string> = new Set([
  'BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'DOT', 'AVAX', 'MATIC', 'ATOM',
  'LTC', 'TRX', 'BCH', 'XLM', 'ALGO', 'VET', 'FIL', 'NEAR', 'APT', 'ARB',
  'OP', 'INJ', 'SUI', 'SEI', 'TON', 'HBAR', 'ETC', 'XMR', 'ICP', 'FTM',
  'EGLD', 'THETA', 'XTZ', 'EOS', 'CRO', 'PEPE', 'SHIB', 'UNI', 'LINK',
  'AAVE', 'MKR', 'GRT', 'SAND', 'MANA', 'AXS', 'APE', 'LDO', 'CRV', 'SNX',
  'COMP', '1INCH', 'ENS', 'BAT', 'USDT', 'USDC', 'DAI', 'WBTC', 'WETH',
  'POL', 'BNB', 'LEO', 'OKB', 'FDUSD', 'RENDER', 'TAO', 'KAS', 'IMX',
]);

export function isKnownCryptoTicker(ticker: string): boolean {
  return KNOWN_CRYPTO_TICKERS.has(ticker.toUpperCase());
}

/**
 * Detect the asset type of a single Plaid security. Returns a fully-
 * resolved `SecurityInfo` with classification baked in.
 *
 * Mirrors the legacy inline logic verbatim, including the preference for
 * ticker_symbol → name → security_id as the display ticker.
 */
export function classifySecurity(security: PlaidSecurity): SecurityInfo {
  const tickerRaw = security.ticker_symbol || security.name || security.security_id;
  const ticker = tickerRaw.toUpperCase();

  const isCryptoFromPlaid = security.type === 'cryptocurrency';
  const isCryptoFromKnownSymbol = isKnownCryptoTicker(ticker);
  const isCrypto = isCryptoFromPlaid || isCryptoFromKnownSymbol;
  const isCash = security.type === 'cash' || security.is_cash_equivalent === true;

  let assetType: AssetType = 'stock';
  if (isCrypto) assetType = 'crypto';
  else if (isCash) assetType = 'cash';

  return {
    ticker,
    type: security.type ?? null,
    isCrypto,
    isCash,
    name: security.name ?? null,
    assetType,
  };
}

/**
 * Build a security_id → SecurityInfo map for a whole holdings response.
 */
export function buildSecurityMap(
  securities: PlaidSecurity[] | null | undefined
): Map<string, SecurityInfo> {
  const map = new Map<string, SecurityInfo>();
  if (!securities) return map;
  for (const sec of securities) {
    map.set(sec.security_id, classifySecurity(sec));
  }
  return map;
}

/**
 * Fallback SecurityInfo for a holding whose security isn't in the map.
 * The legacy route constructs this inline; extracting it keeps the main
 * pipeline readable and testable.
 */
export function makeFallbackSecurityInfo(securityId: string): SecurityInfo {
  const fallbackTicker = (securityId || '').toUpperCase();
  const isCryptoFallback = isKnownCryptoTicker(fallbackTicker);
  return {
    ticker: fallbackTicker,
    type: null,
    isCrypto: isCryptoFallback,
    isCash: false,
    name: fallbackTicker,
    assetType: isCryptoFallback ? 'crypto' : 'stock',
  };
}

/**
 * Legacy cash-position marker: some brokers returned cash positions with
 * ticker prefixed by `CUR:` (e.g. `CUR:USD`). New data should come through
 * as `security.type === 'cash'`, but old rows still live in the DB and
 * we keep the detection around.
 */
export function isLegacyCashTicker(ticker: string): boolean {
  return ticker.toUpperCase().startsWith('CUR:');
}

/**
 * Heuristic: is this DB account likely to be an equity-compensation
 * account (RSU vesting, ESPP, stock plan)? Used to decide whether to
 * treat missing vesting fields as "assume all unvested" vs "assume all
 * vested" when Plaid is ambiguous.
 *
 * Exposed for test assertions.
 */
export function isLikelyEquityCompAccount(account: Pick<DbAccountRow, 'subtype' | 'name'>): boolean {
  const subtype = (account.subtype || '').toLowerCase();
  const name = (account.name || '').toLowerCase();
  const markers = ['stock plan', 'equity', 'rsu', 'espp', 'employee'];
  return markers.some((m) => subtype.includes(m) || name.includes(m));
}
