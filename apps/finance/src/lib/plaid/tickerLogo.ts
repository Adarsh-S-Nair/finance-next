/**
 * logo.dev ticker-logo resolution.
 *
 * logo.dev exposes two logo paths:
 *   - domain-based  (https://img.logo.dev/DOMAIN)        — needs a company website
 *   - ticker-based  (https://img.logo.dev/ticker/SYMBOL) — resolves by symbol and,
 *     unlike the domain path, also covers ETFs and money-market funds.
 *
 * Holdings sync derives logos from the Finnhub company domain, but Finnhub's
 * company-profile endpoint returns nothing for funds (e.g. QQQM), so those
 * positions get no domain and thus no logo. The ticker endpoint is the fallback
 * that fills that gap.
 *
 * We always validate with `fallback=404` so logo.dev 404s for a symbol it has no
 * real image for (instead of serving a generic monogram), and we only persist a
 * URL that actually resolves.
 */

const LOGO_DEV_TICKER_BASE = 'https://img.logo.dev/ticker';
const LOGO_RESOLVE_TIMEOUT_MS = 4000;

/** Build the ticker-logo URL we persist (no `fallback` param — that's validation-only). */
export function tickerLogoUrl(symbol: string, token: string): string {
  return `${LOGO_DEV_TICKER_BASE}/${encodeURIComponent(symbol)}?token=${token}`;
}

/**
 * Return the logo URL for a symbol if logo.dev actually has one, else null.
 * `fallback=404` makes logo.dev 404 instead of serving a generic monogram, so
 * we never persist a logo URL for a symbol with no real brand image.
 */
export async function resolveTickerLogo(symbol: string, token: string): Promise<string | null> {
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
