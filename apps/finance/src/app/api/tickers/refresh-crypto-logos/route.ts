import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { createLogger } from '../../../../lib/logger';
import { withAuth } from '../../../../lib/api/withAuth';
import { isCallerAdmin } from '../../../../lib/api/admin';

const logger = createLogger('refresh-crypto-logos');

interface CoinGeckoSearchCoin {
  id: string;
  symbol: string;
  name: string;
  large?: string;
  small?: string;
  thumb?: string;
}

async function requireAdmin(userId: string): Promise<Response | null> {
  const allowed = await isCallerAdmin(userId);
  if (!allowed) {
    return Response.json(
      { error: 'Forbidden', message: 'Admin access required' },
      { status: 403 }
    );
  }
  return null;
}

async function fetchCryptoInfoFromCoinGecko(
  ticker: string
): Promise<{ logo: string | null; name: string | null }> {
  try {
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`;
    const response = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return { logo: null, name: null };
    }

    const data = (await response.json()) as { coins?: CoinGeckoSearchCoin[] };
    const coins = data.coins || [];

    const exactMatch = coins.find((c) => c.symbol.toUpperCase() === ticker.toUpperCase());
    const coin = exactMatch || coins[0];

    if (coin) {
      return {
        logo: coin.large || coin.small || coin.thumb || null,
        name: coin.name || null,
      };
    }

    return { logo: null, name: null };
  } catch (error) {
    console.error(
      `Error fetching ${ticker} from CoinGecko:`,
      error instanceof Error ? error.message : String(error)
    );
    return { logo: null, name: null };
  }
}

interface RequestBody {
  forceRefresh?: boolean;
}

interface UpdatePayload {
  symbol: string;
  logo: string;
  name: string | null;
}

export const POST = withAuth('refresh-crypto-logos:post', async (request, userId) => {
  const denied = await requireAdmin(userId);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const forceRefresh = body.forceRefresh === true;

  let query = supabaseAdmin
    .from('tickers')
    .select('symbol, name, logo')
    .eq('asset_type', 'crypto');

  if (!forceRefresh) {
    query = query.or('logo.is.null,logo.eq.');
  }

  const { data: cryptoTickers, error } = await query;

  if (error) {
    logger.error('Error fetching crypto tickers', null, { error });
    return Response.json({ error: 'Failed to fetch crypto tickers' }, { status: 500 });
  }

  if (!cryptoTickers || cryptoTickers.length === 0) {
    return Response.json({
      success: true,
      message: 'No crypto tickers need logo updates',
      updated: 0,
    });
  }

  logger.info('Refreshing crypto logos', {
    count: cryptoTickers.length,
    forceRefresh,
    tickers: cryptoTickers.map((t) => t.symbol),
  });

  const updates: UpdatePayload[] = [];
  const BATCH_SIZE = 5;
  const DELAY_MS = 250; // Respect CoinGecko rate limits

  for (let i = 0; i < cryptoTickers.length; i += BATCH_SIZE) {
    const batch = cryptoTickers.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map(async (ticker): Promise<UpdatePayload | null> => {
        const info = await fetchCryptoInfoFromCoinGecko(ticker.symbol);
        if (info.logo) {
          return {
            symbol: ticker.symbol,
            logo: info.logo,
            name: info.name || ticker.name,
          };
        }
        return null;
      })
    );

    updates.push(...batchResults.filter((r): r is UpdatePayload => Boolean(r)));

    if (i + BATCH_SIZE < cryptoTickers.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  let updatedCount = 0;
  for (const update of updates) {
    const { error: updateError } = await supabaseAdmin
      .from('tickers')
      .update({ logo: update.logo, name: update.name })
      .eq('symbol', update.symbol);

    if (!updateError) {
      updatedCount++;
      logger.info('Updated crypto logo', { symbol: update.symbol, logo: update.logo });
    } else {
      logger.warn('Failed to update ticker', {
        symbol: update.symbol,
        error: updateError,
      });
    }
  }

  return Response.json({
    success: true,
    message: `Updated ${updatedCount} crypto logos`,
    updated: updatedCount,
    total: cryptoTickers.length,
    details: updates.map((u) => ({ symbol: u.symbol, hasLogo: !!u.logo })),
  });
});

/**
 * GET /api/tickers/refresh-crypto-logos
 * Returns status of crypto tickers and their logos
 */
export const GET = withAuth('refresh-crypto-logos:get', async (_request, userId) => {
  const denied = await requireAdmin(userId);
  if (denied) return denied;

  const { data: cryptoTickers, error } = await supabaseAdmin
    .from('tickers')
    .select('symbol, name, logo, asset_type')
    .eq('asset_type', 'crypto')
    .order('symbol');

  if (error) {
    return Response.json({ error: 'Failed to fetch crypto tickers' }, { status: 500 });
  }

  const withLogos = (cryptoTickers ?? []).filter((t) => t.logo && t.logo.trim() !== '');
  const withoutLogos = (cryptoTickers ?? []).filter((t) => !t.logo || t.logo.trim() === '');

  return Response.json({
    total: cryptoTickers?.length ?? 0,
    withLogos: withLogos.length,
    withoutLogos: withoutLogos.length,
    tickers: (cryptoTickers ?? []).map((t) => ({
      symbol: t.symbol,
      name: t.name,
      hasLogo: !!(t.logo && t.logo.trim() !== ''),
      logo: t.logo,
    })),
  });
});
