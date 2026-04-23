/**
 * Market Data Utilities
 *
 * Finnhub-backed helpers for fetching ticker metadata (name, sector, domain).
 * Used by the Plaid holdings sync pipeline to enrich newly-discovered tickers
 * before inserting them into the `tickers` table.
 */

export interface TickerDetails {
  ticker: string;
  name: string | null;
  sector: string | null;
  domain: string | null;
  error?: string;
}

interface FinnhubProfile {
  name?: string | null;
  finnhubIndustry?: string | null;
  industry?: string | null;
  gicsSector?: string | null;
  weburl?: string | null;
  url?: string | null;
}

/**
 * Fetch basic ticker details (name, sector, domain) from Finnhub.
 * Includes retry logic for rate limiting.
 */
export async function fetchTickerDetails(
  ticker: string,
  retries: number = 3
): Promise<TickerDetails> {
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

      if (finnhubResponse.status === 429) {
        if (attempt < retries) {
          const backoffDelay = Math.pow(2, attempt) * 1000;
          console.log(
            `  [${ticker}] Rate limited (429), retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${retries + 1})`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
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

      const finnhubData = (await finnhubResponse.json()) as FinnhubProfile;

      const name = finnhubData.name || null;
      const sector =
        finnhubData.finnhubIndustry ||
        finnhubData.industry ||
        finnhubData.gicsSector ||
        null;

      let domain: string | null = null;
      const website = finnhubData.weburl || finnhubData.url || null;
      if (website) {
        try {
          const url = new URL(website.startsWith('http') ? website : `https://${website}`);
          domain = url.hostname.replace('www.', '');
        } catch {
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
      const e = error as { message?: string };
      if (attempt < retries) {
        const backoffDelay = Math.pow(2, attempt) * 1000;
        console.log(
          `  [${ticker}] Error, retrying in ${backoffDelay}ms... (attempt ${attempt + 1}/${retries + 1}):`,
          e.message
        );
        await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        continue;
      }

      console.error(`Error fetching ticker details for ${ticker}:`, e.message);
      return {
        ticker,
        name: null,
        sector: null,
        domain: null,
        error: e.message ?? String(error),
      };
    }
  }

  // Unreachable: the loop either returns or continues.
  return { ticker, name: null, sector: null, domain: null, error: 'unreachable' };
}

/**
 * Fetch basic ticker details for multiple tickers using Finnhub.
 * Processes requests sequentially with delays to avoid rate limiting.
 */
export async function fetchBulkTickerDetails(
  tickers: string[],
  delayMs: number = 250
): Promise<TickerDetails[]> {
  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  if (!finnhubApiKey) {
    console.warn('⚠️  FINNHUB_API_KEY not found - cannot fetch ticker details');
    return tickers.map((ticker) => ({
      ticker,
      name: null,
      sector: null,
      domain: null,
      error: 'FINNHUB_API_KEY not found',
    }));
  }

  console.log(
    `\n📊 Fetching ticker details for ${tickers.length} tickers from Finnhub...`
  );
  console.log(
    `   Processing sequentially with ${delayMs}ms delay between requests`
  );
  console.log(
    `   This will take approximately ${Math.ceil((tickers.length * delayMs) / 1000)} seconds\n`
  );

  const results: TickerDetails[] = [];
  let successCount = 0;
  let errorCount = 0;
  let rateLimitCount = 0;

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
          console.log(
            `  ${progress} ✓ ${ticker}: ${result.name || ticker}${result.domain ? ` (${result.domain})` : ''}`
          );
        } else {
          console.log(`  ${progress} ⚠ ${ticker}: No data returned`);
        }
      }

      if (i < tickers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      const e = error as { message?: string };
      errorCount++;
      results.push({
        ticker,
        name: null,
        sector: null,
        domain: null,
        error: e.message ?? String(error),
      });
      console.log(`  ${progress} ✗ ${ticker}: ${e.message ?? error}`);

      if (i < tickers.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const successful = results.filter((r) => !r.error);
  const withName = successful.filter((r) => r.name).length;
  const withDomain = successful.filter((r) => r.domain).length;
  const withSector = successful.filter((r) => r.sector).length;

  console.log(`\n📊 Fetch Summary:`);
  console.log(`   Total: ${results.length} tickers`);
  console.log(`   Successful: ${successCount} tickers`);
  console.log(`   Errors: ${errorCount} tickers`);
  if (rateLimitCount > 0) {
    console.log(`   ⚠️  Rate limited: ${rateLimitCount} tickers`);
  }
  if (successful.length > 0) {
    console.log(
      `   With name: ${withName} tickers (${((withName / successful.length) * 100).toFixed(1)}%)`
    );
    console.log(
      `   With domain: ${withDomain} tickers (${((withDomain / successful.length) * 100).toFixed(1)}%)`
    );
    console.log(
      `   With sector: ${withSector} tickers (${((withSector / successful.length) * 100).toFixed(1)}%)`
    );
  }

  return results;
}
