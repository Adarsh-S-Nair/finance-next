/**
 * Market Data Utilities
 *
 * Finnhub-backed helpers for fetching ticker metadata (name, sector, domain).
 * Used by the Plaid holdings sync pipeline to enrich newly-discovered tickers
 * before inserting them into the `tickers` table.
 *
 * Historically this module also contained NASDAQ-100 scraping, Yahoo Finance
 * stock data fetching, and market-status checks that fed the now-removed
 * paper-trading / arbitrage experiments. All of that has been deleted — if
 * you're looking for it, see git history before the teardown commit.
 */

/**
 * Fetch basic ticker details (name, sector, domain) from Finnhub.
 * Includes retry logic for rate limiting.
 *
 * @param {string} ticker - Stock ticker symbol
 * @param {number} retries - Number of retries for rate limit errors (default: 3)
 * @returns {Promise<Object>} Object with ticker, name, sector, domain
 */
export async function fetchTickerDetails(ticker, retries = 3) {
  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  if (!finnhubApiKey) {
    return {
      ticker,
      name: null,
      sector: null,
      domain: null,
      error: 'FINNHUB_API_KEY not found',
    };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const finnhubUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubApiKey}`;
      const finnhubResponse = await fetch(finnhubUrl);

      // Handle rate limiting (429) with exponential backoff
      if (finnhubResponse.status === 429) {
        if (attempt < retries) {
          const backoffDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, etc.
          console.log(`  [${ticker}] Rate limited (429), retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${retries + 1})`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          continue; // Retry
        } else {
          return {
            ticker,
            name: null,
            sector: null,
            domain: null,
            error: `Rate limited (429) after ${retries + 1} attempts`,
          };
        }
      }

      if (!finnhubResponse.ok) {
        return {
          ticker,
          name: null,
          sector: null,
          domain: null,
          error: `Finnhub API error: ${finnhubResponse.status}`,
        };
      }

      const finnhubData = await finnhubResponse.json();

      // Extract name
      const name = finnhubData.name || null;

      // Extract sector
      const sector = finnhubData.finnhubIndustry || finnhubData.industry || finnhubData.gicsSector || null;

      // Extract domain from website URL
      let domain = null;
      const website = finnhubData.weburl || finnhubData.url || null;
      if (website) {
        try {
          const url = new URL(website.startsWith('http') ? website : `https://${website}`);
          domain = url.hostname.replace('www.', '');
        } catch {
          // If URL parsing fails, try to extract domain manually
          const match = website.match(/(?:https?:\/\/)?(?:www\.)?([^/]+)/);
          if (match) {
            domain = match[1];
          }
        }
      }

      return {
        ticker,
        name,
        sector,
        domain,
      };

    } catch (error) {
      if (attempt < retries) {
        const backoffDelay = Math.pow(2, attempt) * 1000;
        console.log(`  [${ticker}] Error, retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${retries + 1}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        continue;
      }

      console.error(`Error fetching ticker details for ${ticker}:`, error.message);
      return {
        ticker,
        name: null,
        sector: null,
        domain: null,
        error: error.message,
      };
    }
  }
}

/**
 * Fetch basic ticker details for multiple tickers using Finnhub.
 * Processes requests sequentially with delays to avoid rate limiting.
 *
 * @param {Array<string>} tickers - Array of ticker symbols
 * @param {number} delayMs - Delay between requests in milliseconds (default: 250ms)
 * @returns {Promise<Array<Object>>} Array of ticker detail objects
 */
export async function fetchBulkTickerDetails(tickers, delayMs = 250) {
  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  if (!finnhubApiKey) {
    console.warn('⚠️  FINNHUB_API_KEY not found - cannot fetch ticker details');
    return tickers.map(ticker => ({
      ticker,
      name: null,
      sector: null,
      domain: null,
      error: 'FINNHUB_API_KEY not found',
    }));
  }

  console.log(`\n📊 Fetching ticker details for ${tickers.length} tickers from Finnhub...`);
  console.log(`   Processing sequentially with ${delayMs}ms delay between requests`);
  console.log(`   This will take approximately ${Math.ceil((tickers.length * delayMs) / 1000)} seconds\n`);

  const results = [];
  let successCount = 0;
  let errorCount = 0;
  let rateLimitCount = 0;

  // Process sequentially to avoid rate limiting
  for (let i = 0; i < tickers.length; i++) {
    const ticker = tickers[i];
    const progress = `[${i + 1}/${tickers.length}]`;

    try {
      const result = await fetchTickerDetails(ticker);
      results.push(result);

      if (result.error) {
        errorCount++;
        if (result.error.includes('429') || result.error.includes('Rate limited')) {
          rateLimitCount++;
        }
        console.log(`  ${progress} ✗ ${ticker}: ${result.error}`);
      } else {
        successCount++;
        const hasData = result.name || result.sector || result.domain;
        if (hasData) {
          console.log(`  ${progress} ✓ ${ticker}: ${result.name || ticker}${result.domain ? ` (${result.domain})` : ''}`);
        } else {
          console.log(`  ${progress} ⚠ ${ticker}: No data returned`);
        }
      }

      // Delay between requests (except for the last one)
      if (i < tickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      errorCount++;
      results.push({
        ticker,
        name: null,
        sector: null,
        domain: null,
        error: error.message,
      });
      console.log(`  ${progress} ✗ ${ticker}: ${error.message}`);

      // Still delay even on error
      if (i < tickers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  // Summary statistics
  const successful = results.filter(r => !r.error);
  const withName = successful.filter(r => r.name).length;
  const withDomain = successful.filter(r => r.domain).length;
  const withSector = successful.filter(r => r.sector).length;

  console.log(`\n📊 Fetch Summary:`);
  console.log(`   Total: ${results.length} tickers`);
  console.log(`   Successful: ${successCount} tickers`);
  console.log(`   Errors: ${errorCount} tickers`);
  if (rateLimitCount > 0) {
    console.log(`   ⚠️  Rate limited: ${rateLimitCount} tickers`);
  }
  if (successful.length > 0) {
    console.log(`   With name: ${withName} tickers (${((withName / successful.length) * 100).toFixed(1)}%)`);
    console.log(`   With domain: ${withDomain} tickers (${((withDomain / successful.length) * 100).toFixed(1)}%)`);
    console.log(`   With sector: ${withSector} tickers (${((withSector / successful.length) * 100).toFixed(1)}%)`);
  }

  return results;
}
