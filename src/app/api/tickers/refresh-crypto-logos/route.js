import { supabaseAdmin } from '../../../../lib/supabaseAdmin';
import { createLogger } from '../../../../lib/logger';

const logger = createLogger('refresh-crypto-logos');

/**
 * Fetch crypto logo from CoinGecko API
 * @param {string} ticker - Crypto ticker symbol
 * @returns {Promise<{logo: string|null, name: string|null}>}
 */
async function fetchCryptoInfoFromCoinGecko(ticker) {
  try {
    const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(ticker)}`;
    const response = await fetch(searchUrl, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) {
      return { logo: null, name: null };
    }
    
    const data = await response.json();
    const coins = data.coins || [];
    
    // Find exact symbol match first
    const exactMatch = coins.find(c => c.symbol.toUpperCase() === ticker.toUpperCase());
    const coin = exactMatch || coins[0];
    
    if (coin) {
      return {
        logo: coin.large || coin.small || coin.thumb || null,
        name: coin.name || null
      };
    }
    
    return { logo: null, name: null };
  } catch (error) {
    console.error(`Error fetching ${ticker} from CoinGecko:`, error.message);
    return { logo: null, name: null };
  }
}

/**
 * POST /api/tickers/refresh-crypto-logos
 * Refreshes logos for all crypto tickers that are missing logos or have broken ones
 * Optionally force refresh all crypto logos
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh === true;
    
    // Get all crypto tickers
    let query = supabaseAdmin
      .from('tickers')
      .select('symbol, name, logo')
      .eq('asset_type', 'crypto');
    
    // Only get tickers missing logos unless force refresh
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
        updated: 0 
      });
    }
    
    logger.info('Refreshing crypto logos', { 
      count: cryptoTickers.length, 
      forceRefresh,
      tickers: cryptoTickers.map(t => t.symbol)
    });
    
    const updates = [];
    const BATCH_SIZE = 5;
    const DELAY_MS = 250; // Respect CoinGecko rate limits
    
    for (let i = 0; i < cryptoTickers.length; i += BATCH_SIZE) {
      const batch = cryptoTickers.slice(i, i + BATCH_SIZE);
      
      const batchResults = await Promise.all(
        batch.map(async (ticker) => {
          const info = await fetchCryptoInfoFromCoinGecko(ticker.symbol);
          if (info.logo) {
            return {
              symbol: ticker.symbol,
              logo: info.logo,
              name: info.name || ticker.name
            };
          }
          return null;
        })
      );
      
      updates.push(...batchResults.filter(Boolean));
      
      // Rate limit delay
      if (i + BATCH_SIZE < cryptoTickers.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
    }
    
    // Update tickers in database
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
        logger.warn('Failed to update ticker', { symbol: update.symbol, error: updateError });
      }
    }
    
    return Response.json({
      success: true,
      message: `Updated ${updatedCount} crypto logos`,
      updated: updatedCount,
      total: cryptoTickers.length,
      details: updates.map(u => ({ symbol: u.symbol, hasLogo: !!u.logo }))
    });
    
  } catch (error) {
    logger.error('Error refreshing crypto logos', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET /api/tickers/refresh-crypto-logos
 * Returns status of crypto tickers and their logos
 */
export async function GET() {
  try {
    const { data: cryptoTickers, error } = await supabaseAdmin
      .from('tickers')
      .select('symbol, name, logo, asset_type')
      .eq('asset_type', 'crypto')
      .order('symbol');
    
    if (error) {
      return Response.json({ error: 'Failed to fetch crypto tickers' }, { status: 500 });
    }
    
    const withLogos = cryptoTickers.filter(t => t.logo && t.logo.trim() !== '');
    const withoutLogos = cryptoTickers.filter(t => !t.logo || t.logo.trim() === '');
    
    return Response.json({
      total: cryptoTickers.length,
      withLogos: withLogos.length,
      withoutLogos: withoutLogos.length,
      tickers: cryptoTickers.map(t => ({
        symbol: t.symbol,
        name: t.name,
        hasLogo: !!(t.logo && t.logo.trim() !== ''),
        logo: t.logo
      }))
    });
  } catch (error) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

