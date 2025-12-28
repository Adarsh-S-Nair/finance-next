/**
 * Initialize a new AI portfolio with first trading decisions
 * 
 * This endpoint:
 * 1. Creates the portfolio in the database
 * 2. Calls the AI model with the trading prompt
 * 3. Logs the response and initial trades
 * 4. Returns the created portfolio with AI response
 * 
 * TEMPORARY: Currently fetching stock data for testing (LLM and DB creation commented out)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loadPrompt, fillTemplate } from '../../../../lib/promptLoader';
import { callGemini } from '../../../../lib/geminiClient';
import { scrapeNasdaq100Constituents, fetchBulkStockData, fetchBulkTickerDetails, checkMarketStatus } from '../../../../lib/marketData';
import { formatDateString } from '../../../../lib/portfolioUtils';

// Mark route as dynamic to avoid build-time analysis
export const dynamic = 'force-dynamic';

// Lazy create Supabase client to avoid build-time errors
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Create initial portfolio snapshot
 * Works for both AI and non-AI portfolios, stock and crypto
 */
async function createInitialPortfolioSnapshot(supabase, portfolio, assetType, cryptoAssets, holdingsMap = new Map(), cash, priceMap = new Map()) {
  console.log('\n📸 CREATING INITIAL PORTFOLIO SNAPSHOT');
  console.log('========================================');
  
  // Calculate holdings value using current prices
  let holdingsValue = 0;
  
  // For crypto portfolios, fetch current crypto prices from candles table
  if (assetType === 'crypto' && cryptoAssets && cryptoAssets.length > 0) {
    console.log('   Fetching current crypto prices for snapshot...');
    
    // Fetch latest prices for each crypto asset
    const cryptoPriceMap = new Map();
    for (const symbol of cryptoAssets) {
      const symbolUpper = symbol.toUpperCase();
      const productId = `${symbolUpper}-USD`;
      
      try {
        // Get the most recent candle for this product
        const { data: latestCandle, error: candleError } = await supabase
          .from('crypto_candles')
          .select('close')
          .eq('product_id', productId)
          .eq('timeframe', '1m')
          .order('time', { ascending: false })
          .limit(1)
          .single();
        
        if (!candleError && latestCandle) {
          const price = parseFloat(latestCandle.close);
          cryptoPriceMap.set(symbolUpper, price);
          console.log(`   ${symbolUpper}: $${price.toFixed(2)}`);
        } else {
          console.log(`   ⚠️  Could not fetch price for ${symbolUpper}`);
        }
      } catch (err) {
        console.log(`   ⚠️  Error fetching price for ${symbolUpper}:`, err.message);
      }
    }
    
    // Calculate holdings value using crypto prices
    for (const [ticker, holding] of holdingsMap.entries()) {
      const currentPrice = cryptoPriceMap.get(ticker);
      if (currentPrice) {
        holdingsValue += holding.shares * currentPrice;
      } else {
        // Fall back to avg_cost if price not available
        holdingsValue += holding.shares * holding.avg_cost;
      }
    }
  } else {
    // For stock portfolios, use priceMap from stock data
    for (const [ticker, holding] of holdingsMap.entries()) {
      const currentPrice = priceMap.get(ticker);
      if (currentPrice) {
        holdingsValue += holding.shares * currentPrice;
      } else {
        // Fall back to avg_cost if price not available
        holdingsValue += holding.shares * holding.avg_cost;
      }
    }
  }
  
  const totalValue = cash + holdingsValue;
  const snapshotDate = formatDateString(new Date()); // YYYY-MM-DD format (local time)
  
  console.log(`   Cash: $${cash.toFixed(2)}`);
  console.log(`   Holdings Value: $${holdingsValue.toFixed(2)}`);
  console.log(`   Total Value: $${totalValue.toFixed(2)}`);
  console.log(`   Snapshot Date: ${snapshotDate}`);
  
  const { data: snapshotData, error: snapshotError } = await supabase
    .from('portfolio_snapshots')
    .insert({
      portfolio_id: portfolio.id,
      total_value: totalValue,
      cash: cash,
      holdings_value: holdingsValue,
      snapshot_date: snapshotDate,
    })
    .select()
    .single();
  
  if (snapshotError) {
    console.error('❌ Failed to create portfolio snapshot:', snapshotError);
    return { success: false, error: snapshotError };
  } else {
    console.log(`✅ Created initial portfolio snapshot (ID: ${snapshotData.id})`);
    if (assetType === 'crypto') {
      console.log('   📊 Crypto portfolio baseline snapshot created');
    }
    console.log('========================================\n');
    return { success: true, data: snapshotData };
  }
}

export async function POST(request) {
  try {
    // Create Supabase client (lazy, only when actually needed)
    const supabase = getSupabaseClient();
    
    const body = await request.json();
    const { userId, name, aiModel, startingCapital, assetType = 'stock', cryptoAssets } = body;

    // Validate required fields
    if (!userId || !name || !startingCapital) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name, startingCapital' },
        { status: 400 }
      );
    }

    // Validate assetType
    if (assetType !== 'stock' && assetType !== 'crypto') {
      return NextResponse.json(
        { error: 'Invalid assetType. Must be "stock" or "crypto"' },
        { status: 400 }
      );
    }

    // If AI is enabled, validate aiModel
    if (aiModel && !AI_MODELS[aiModel]) {
      return NextResponse.json(
        { error: 'Invalid aiModel' },
        { status: 400 }
      );
    }

    // Validate cryptoAssets for crypto portfolios
    if (assetType === 'crypto') {
      if (!cryptoAssets || !Array.isArray(cryptoAssets) || cryptoAssets.length === 0) {
        return NextResponse.json(
          { error: 'cryptoAssets must be a non-empty array for crypto portfolios' },
          { status: 400 }
        );
      }
      // Validate crypto symbols
      const validCryptos = ['BTC', 'ETH'];
      const invalidCryptos = cryptoAssets.filter(c => !validCryptos.includes(c));
      if (invalidCryptos.length > 0) {
        return NextResponse.json(
          { error: `Invalid crypto symbols: ${invalidCryptos.join(', ')}. Valid symbols: ${validCryptos.join(', ')}` },
          { status: 400 }
        );
      }
    }

    const hasAI = !!aiModel;

    console.log('\n========================================');
    console.log(`🚀 INITIALIZING ${hasAI ? 'AI ' : ''}PORTFOLIO`);
    console.log('========================================');
    console.log(`Portfolio: ${name}`);
    console.log(`AI Model: ${aiModel || 'None (Manual Trading)'}`);
    console.log(`Asset Type: ${assetType}`);
    console.log(`Starting Capital: $${startingCapital.toLocaleString()}`);
    console.log('----------------------------------------');

    // If AI is enabled, fetch market data and initialize AI trading
    // Otherwise, just create the portfolio
    if (hasAI) {
      // Step 1: Scrape Nasdaq 100 constituents from website (first step of workflow)
      console.log('\n📊 STEP 1: SCRAPING NASDAQ-100 CONSTITUENTS');
      console.log('========================================');
      
      const constituents = await scrapeNasdaq100Constituents();
    console.log(`✅ Scraped ${constituents.length} Nasdaq 100 constituents from website`);
    
    // Extract ticker symbols
    const activeTickers = constituents.map(c => c.ticker);
    console.log(`Extracted ${activeTickers.length} ticker symbols`);
    
    // Step 2: Check existing tickers in database
    // NOTE: We use the 'tickers' table exclusively (not nasdaq100_constituents)
    // This ensures all ticker data (name, sector, logo) is centralized in one place
    console.log('\n💾 STEP 2: CHECKING EXISTING TICKERS IN DATABASE');
    console.log('========================================');
    const tickerSymbols = constituents.map(c => c.ticker);
    const { data: existingTickers, error: fetchError } = await supabase
      .from('tickers')
      .select('symbol, logo, name, sector') // Explicitly fetch sector from database
      .in('symbol', tickerSymbols);
    
    // Log how many tickers have sectors in database
    if (existingTickers) {
      const tickersWithSectors = existingTickers.filter(t => t.sector).length;
      console.log(`   📊 Found ${tickersWithSectors} tickers with sectors in database`);
    }
    
    if (fetchError) {
      console.warn('⚠️  Could not fetch existing tickers:', fetchError.message);
    }
    
    // Create a map of existing tickers by symbol for quick lookup
    const existingTickersMap = new Map();
    if (existingTickers) {
      existingTickers.forEach(t => {
        existingTickersMap.set(t.symbol, t);
      });
    }
    
    // Identify tickers that need to be fetched from Finnhub
    // We fetch if: no existing record, or missing logo, or missing name/sector
    // This ensures all tickers have complete data including logos
    const tickersToFetch = constituents.filter(c => {
      const existing = existingTickersMap.get(c.ticker);
      // Fetch if: no existing record, or no logo (empty/null), or missing name/sector
      const needsFetch = !existing || 
                        !existing.logo || 
                        existing.logo.trim() === '' || 
                        !existing.name || 
                        !existing.sector;
      return needsFetch;
    });
    
    const tickersToSkip = constituents.length - tickersToFetch.length;
    
    console.log(`   Found ${existingTickers?.length || 0} existing tickers in database`);
    console.log(`   ${tickersToSkip} tickers already have complete data (skipping)`);
    console.log(`   ${tickersToFetch.length} tickers need data from Finnhub\n`);
    
    // Step 3: Fetch ticker details from Finnhub (only for tickers that need it)
    let tickerDetails = [];
    if (tickersToFetch.length > 0) {
      console.log('📊 STEP 3: FETCHING TICKER DETAILS FROM FINNHUB');
      console.log('========================================');
      const tickersToFetchList = tickersToFetch.map(c => c.ticker);
      // Process all tickers sequentially with delays to avoid rate limiting
      // Using 1000ms delay between requests (60 requests/minute = 1 per second)
      const fetchedDetails = await fetchBulkTickerDetails(tickersToFetchList, 1000);
      tickerDetails = fetchedDetails;
      
      // Separate successful fetches from errors
      const successfulData = tickerDetails.filter(d => !d.error);
      const failedTickers = tickerDetails.filter(d => d.error);
      
      if (failedTickers.length > 0) {
        console.log(`\n⚠️  Failed to fetch data for ${failedTickers.length} tickers:`);
        failedTickers.forEach(d => {
          console.log(`  - ${d.ticker}: ${d.error}`);
        });
      }
      
      console.log(`\n✅ Successfully fetched data for ${successfulData.length} tickers\n`);
    } else {
      console.log('📊 STEP 3: SKIPPING FINNHUB FETCH');
      console.log('========================================');
      console.log('All tickers already have complete data in database!\n');
    }
    
    // Step 4: Store tickers in database with sector and logo (BEFORE AI prompt)
    console.log('\n💾 STEP 4: STORING TICKERS IN DATABASE');
    console.log('========================================');
    
    // Create a map of fetched ticker details by ticker for quick lookup
    const tickerDetailsMap = new Map();
    tickerDetails.forEach(detail => {
      if (!detail.error) {
        tickerDetailsMap.set(detail.ticker, detail);
      }
    });
    
    // Prepare ticker upserts with data from scraping and Finnhub
    // Ensure ALL constituents are included in the tickers table with complete data
    const tickerInserts = constituents.map(c => {
      const existingTicker = existingTickersMap.get(c.ticker);
      const tickerDetail = tickerDetailsMap.get(c.ticker);
      
      // Use existing data if available, otherwise use fetched data, otherwise fall back to scraped name
      const name = existingTicker?.name || tickerDetail?.name || c.name || null;
      const sector = existingTicker?.sector || tickerDetail?.sector || null;
      const domain = tickerDetail?.domain || null;
      
      // Logo logic: preserve existing logo if valid, otherwise generate from domain
      let logo = null;
      const logoDevPublicKey = process.env.LOGO_DEV_PUBLIC_KEY;
      
      if (existingTicker?.logo && existingTicker.logo.trim() !== '') {
        // Preserve existing logo (already has a valid logo)
        logo = existingTicker.logo;
      } else if (domain && logoDevPublicKey) {
        // Generate logo URL from domain using logo.dev
        logo = `https://img.logo.dev/${domain}?token=${logoDevPublicKey}`;
      }
      // If no domain available, logo remains null (will be fetched in future runs)
      
      return {
        symbol: c.ticker,
        name: name,
        sector: sector,
        logo: logo,
      };
    });
    
    // Verify all constituents are being inserted
    const missingTickers = constituents.filter(c => {
      const insert = tickerInserts.find(t => t.symbol === c.ticker);
      return !insert;
    });
    
    if (missingTickers.length > 0) {
      console.warn(`⚠️  Warning: ${missingTickers.length} tickers are missing from inserts:`, 
        missingTickers.map(t => t.ticker).join(', '));
    }
    
    // Upsert tickers into the tickers table
    const { data: insertedTickers, error: tickerError } = await supabase
      .from('tickers')
      .upsert(tickerInserts, {
        onConflict: 'symbol',
        ignoreDuplicates: false, // Update if exists
      })
      .select('symbol, name, sector, logo'); // Explicitly select all fields we need
    
    if (tickerError) {
      console.warn('⚠️  Could not store tickers in database:', tickerError.message);
    } else {
      // Update existingTickersMap with the latest data from database (after upsert)
      // This ensures we have the most up-to-date sectors for enrichment
      if (insertedTickers) {
        insertedTickers.forEach(ticker => {
          existingTickersMap.set(ticker.symbol, ticker);
        });
        
        // Verify sectors are in the map
        const tickersWithSectors = Array.from(existingTickersMap.values()).filter(t => t.sector).length;
        console.log(`   📊 Updated ticker map: ${tickersWithSectors} tickers have sectors in map`);
      }
      
      const withName = tickerInserts.filter(t => t.name).length;
      const withSector = tickerInserts.filter(t => t.sector).length;
      const withLogo = tickerInserts.filter(t => t.logo).length;
      const withDomain = tickerInserts.filter(t => {
        const tickerDetail = tickerDetailsMap.get(t.symbol);
        return tickerDetail?.domain;
      }).length;
      
      // Verify all constituents are in the database
      const totalConstituents = constituents.length;
      const totalInserted = insertedTickers?.length || tickerInserts.length;
      
      console.log(`✅ Stored/updated ${totalInserted} tickers in database (${totalConstituents} total constituents)`);
      console.log(`   - ${withName} with company names (${((withName/totalConstituents)*100).toFixed(1)}%)`);
      console.log(`   - ${withSector} with sector information (${((withSector/totalConstituents)*100).toFixed(1)}%)`);
      console.log(`   - ${withLogo} with logo URLs (${((withLogo/totalConstituents)*100).toFixed(1)}%)`);
      console.log(`   - ${withDomain} with domain information (${((withDomain/totalConstituents)*100).toFixed(1)}%)`);
      
      // Warn if any tickers are missing logos
      const missingLogos = tickerInserts.filter(t => !t.logo).map(t => t.symbol);
      if (missingLogos.length > 0) {
        console.log(`\n⚠️  ${missingLogos.length} tickers are missing logos (will be fetched in future runs):`);
        console.log(`   ${missingLogos.slice(0, 10).join(', ')}${missingLogos.length > 10 ? ` ... and ${missingLogos.length - 10} more` : ''}`);
      }
    }
    console.log('========================================\n');
    
    // Step 5: Fetch stock price data for AI prompt (separate from ticker details)
    console.log('\n📊 STEP 5: FETCHING STOCK PRICE DATA FOR AI PROMPT');
    console.log('========================================');
    
    const stockData = await fetchBulkStockData(activeTickers);
    
    // Separate successful fetches from errors
    const successfulData = stockData.filter(d => !d.error);
    const failedTickers = stockData.filter(d => d.error);
    
    // Enrich stock data with sector from tickers table (prioritize database over Yahoo Finance)
    // This ensures we use the most accurate sector data from our database
    let sectorsFromDb = 0;
    let sectorsFromYahoo = 0;
    let sectorsMissing = 0;
    
    const enrichedData = successfulData.map(stock => {
      const tickerFromDb = existingTickersMap.get(stock.ticker);
      const originalSector = stock.sector; // From Yahoo Finance (if any)
      
      // Always prefer sector from database if available (more reliable than Yahoo Finance)
      if (tickerFromDb?.sector) {
        stock.sector = tickerFromDb.sector;
        sectorsFromDb++;
      } else if (originalSector) {
        // Keep Yahoo Finance sector if database doesn't have one
        sectorsFromYahoo++;
      } else {
        // No sector from either source
        sectorsMissing++;
      }
      
      return stock;
    });
    
    // Log sector enrichment statistics
    console.log(`\n📊 SECTOR ENRICHMENT STATISTICS:`);
    console.log(`   - Sectors from database: ${sectorsFromDb} (${((sectorsFromDb/enrichedData.length)*100).toFixed(1)}%)`);
    console.log(`   - Sectors from Yahoo Finance: ${sectorsFromYahoo} (${((sectorsFromYahoo/enrichedData.length)*100).toFixed(1)}%)`);
    console.log(`   - Missing sectors: ${sectorsMissing} (${((sectorsMissing/enrichedData.length)*100).toFixed(1)}%)\n`);
    
    if (failedTickers.length > 0) {
      console.log(`\n⚠️  Failed to fetch price data for ${failedTickers.length} tickers:`);
      failedTickers.forEach(d => {
        console.log(`  - ${d.ticker}: ${d.error}`);
      });
    }
    
    console.log(`✅ Successfully fetched price data for ${enrichedData.length} stocks\n`);
    
    // Format stock data for LLM prompt
    const formatStockDataForPrompt = (stocks) => {
      if (stocks.length === 0) return 'No stock data available.';
      
      // Create a structured text format that's easy for LLM to parse
      let formatted = `\nAvailable NASDAQ-100 Stocks (${stocks.length} total):\n\n`;
      formatted += 'Ticker | Price | 1d Ret% | 5d Ret% | 20d Ret% | Dist from 50MA% | Avg $Volume | Sector\n';
      formatted += '-'.repeat(100) + '\n';
      
      stocks.forEach(stock => {
        const price = stock.currentPrice?.toFixed(2) || 'N/A';
        const ret1d = stock.return1d !== null ? `${stock.return1d > 0 ? '+' : ''}${stock.return1d.toFixed(2)}%` : 'N/A';
        const ret5d = stock.return5d !== null ? `${stock.return5d > 0 ? '+' : ''}${stock.return5d.toFixed(2)}%` : 'N/A';
        const ret20d = stock.return20d !== null ? `${stock.return20d > 0 ? '+' : ''}${stock.return20d.toFixed(2)}%` : 'N/A';
        const distSMA50 = stock.distanceFromSMA50 !== null ? `${stock.distanceFromSMA50 > 0 ? '+' : ''}${stock.distanceFromSMA50.toFixed(2)}%` : 'N/A';
        const avgVol = stock.avgDollarVolume !== null ? `$${(stock.avgDollarVolume / 1000000).toFixed(1)}M` : 'N/A';
        const sector = stock.sector || 'N/A';
        
        formatted += `${stock.ticker.padEnd(6)} | $${price.padStart(8)} | ${ret1d.padStart(7)} | ${ret5d.padStart(7)} | ${ret20d.padStart(8)} | ${distSMA50.padStart(15)} | ${avgVol.padStart(12)} | ${sector}\n`;
      });
      
      formatted += '\nKey Metrics Explained:\n';
      formatted += '- Price: Current stock price\n';
      formatted += '- 1d/5d/20d Ret%: Percentage return over 1, 5, and 20 days\n';
      formatted += '- Dist from 50MA%: Percentage distance from 50-day moving average (positive = above MA, negative = below MA)\n';
      formatted += '- Avg $Volume: Average daily dollar volume (liquidity indicator)\n';
      formatted += '- Sector: GICS sector classification\n';
      
      return formatted;
    };
    
    const stockDataForPrompt = formatStockDataForPrompt(enrichedData);
    
    // Print to logs for debugging
    console.log('\n📈 STOCK DATA SUMMARY:');
    console.log('========================================');
    console.log(`Total stocks with data: ${enrichedData.length}`);
    console.log(`Failed tickers: ${failedTickers.length}`);
    console.log('========================================\n');

      // Step 4: Create the portfolio in the database (before AI processing)
      // Calculate next rebalance date (1 month from today for monthly cadence)
      const today = new Date();
      const nextRebalanceDate = new Date(today);
      nextRebalanceDate.setMonth(nextRebalanceDate.getMonth() + 1);
      // Format as YYYY-MM-DD using local date (not UTC) to avoid timezone issues
      const year = nextRebalanceDate.getFullYear();
      const month = String(nextRebalanceDate.getMonth() + 1).padStart(2, '0');
      const day = String(nextRebalanceDate.getDate()).padStart(2, '0');
      const nextRebalanceDateStr = `${year}-${month}-${day}`;
      
      const { data: portfolio, error: insertError } = await supabase
        .from('portfolios')
        .insert({
          user_id: userId,
          name: name.trim(),
          type: 'ai_simulation',
          asset_type: assetType,
          ai_model: aiModel,
          starting_capital: startingCapital,
          current_cash: startingCapital,
          status: 'initializing', // Start in initializing state
          rebalance_cadence: 'monthly', // Default to monthly for all new portfolios
          next_rebalance_date: nextRebalanceDateStr,
          previous_rebalance_date: null, // No previous rebalance for new portfolio
          crypto_assets: assetType === 'crypto' ? cryptoAssets : null,
          portfolio_type: assetType === 'crypto' ? 'trading' : 'investing', // Crypto portfolios are for trading
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        throw new Error(`Failed to create portfolio: ${insertError.message}`);
      }

      console.log(`✅ Portfolio created with ID: ${portfolio.id}`);

      // Step 5: Create price map for quick lookups (needed for holdings formatting)
      const priceMap = new Map();
      enrichedData.forEach(stock => {
        if (stock.currentPrice) {
          priceMap.set(stock.ticker, stock.currentPrice);
        }
      });
      
      // Step 6: Fetch current portfolio holdings (if any)
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('ticker, shares, avg_cost')
      .eq('portfolio_id', portfolio.id);
    
    if (holdingsError) {
      console.warn('⚠️  Could not fetch holdings:', holdingsError.message);
    }
    
    // Calculate total portfolio value for weight calculations
    const totalPortfolioValue = parseFloat(portfolio.current_cash) + 
      (holdings?.reduce((sum, h) => {
        const price = priceMap.get(h.ticker) || parseFloat(h.avg_cost);
        return sum + (parseFloat(h.shares) * price);
      }, 0) || 0);
    
    // Format holdings for prompt (with weights, P&L, etc. for rebalance mode)
    const formatHoldingsForPrompt = (holdings, mode, priceMap, totalValue) => {
      if (!holdings || holdings.length === 0 || mode === 'NEW_PORTFOLIO') {
        return 'Current Holdings: None (new portfolio)';
      }
      
      // Rebalance mode - detailed holdings table
      let formatted = `\nCurrent Portfolio Holdings (${holdings.length} positions):\n\n`;
      formatted += 'Ticker | Shares | Avg Cost | Current Price | Weight % | Unrealized P&L %\n';
      formatted += '-'.repeat(80) + '\n';
      
      holdings.forEach(holding => {
        const ticker = holding.ticker;
        const shares = parseFloat(holding.shares);
        const avgCost = parseFloat(holding.avg_cost);
        const currentPrice = priceMap.get(ticker) || avgCost;
        const positionValue = shares * currentPrice;
        const weight = totalValue > 0 ? (positionValue / totalValue) * 100 : 0;
        const unrealizedPnL = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;
        
        formatted += `${ticker.padEnd(6)} | ${shares.toFixed(4).padStart(8)} | $${avgCost.toFixed(2).padStart(8)} | $${currentPrice.toFixed(2).padStart(11)} | ${weight.toFixed(2).padStart(7)}% | ${unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(2).padStart(7)}%\n`;
      });
      
      formatted += '-'.repeat(80) + '\n';
      const totalHoldingsValue = holdings.reduce((sum, h) => {
        const price = priceMap.get(h.ticker) || parseFloat(h.avg_cost);
        return sum + (parseFloat(h.shares) * price);
      }, 0);
      formatted += `Total Holdings Value: $${totalHoldingsValue.toFixed(2)} (${totalValue > 0 ? ((totalHoldingsValue / totalValue) * 100).toFixed(2) : 0}% of portfolio)\n`;
      
      return formatted;
    };
    
    // Determine mode and build appropriate prompt
    const mode = (holdings && holdings.length > 0) ? 'REBALANCE' : 'NEW_PORTFOLIO';
    const modeInstructions = mode === 'NEW_PORTFOLIO' 
      ? 'This is a new portfolio. Make your initial investment decisions.'
      : 'This is an existing portfolio. Rebalance only if justified.\nYou are allowed to make NO trades if no action is warranted.\nPrefer incremental changes (trims/adds) over replacing the entire portfolio.\nUse sells/trims primarily to fix rule violations or to replace deteriorating setups.';
    
    const holdingsForPrompt = formatHoldingsForPrompt(holdings, mode, priceMap, totalPortfolioValue);

    // Step 7: Load and fill the trading prompt
    const tradingPrompt = loadPrompt('trading');
    
    // Build the user prompt with mode-based template variables
    const userPrompt = fillTemplate(tradingPrompt.user, {
      name: name,
      starting_capital: startingCapital.toLocaleString(),
      current_cash: portfolio.current_cash.toLocaleString(),
      mode: mode,
      mode_instructions: modeInstructions,
      holdings_table: holdingsForPrompt,
      universe_table: stockDataForPrompt,
    });

    // Log the complete prompt before sending
    console.log('\n📝 COMPLETE PROMPT TO BE SENT TO AI:');
    console.log('========================================');
    console.log('--- System Prompt ---');
    console.log(tradingPrompt.system);
    console.log('\n--- User Prompt (with stock data) ---');
    console.log(userPrompt);
    console.log('========================================\n');

    // Step 8: Call the AI model
    let aiResponse;
    try {
      if (aiModel.startsWith('gemini')) {
        // Increase maxTokens to ensure we get the full response
        // Using 8192 as a safe upper limit for JSON responses with multiple trades
        aiResponse = await callGemini(
          aiModel,
          tradingPrompt.system,
          userPrompt,
          { 
            temperature: 0.7, 
            maxTokens: 8192,
            responseMimeType: 'application/json'
          }
        );
      } else {
        // For now, only Gemini is supported
        throw new Error(`Model ${aiModel} is not yet supported`);
      }

      console.log('\n🤖 FULL AI RESPONSE:');
      console.log('========================================');
      // Log the full response - check if it's complete
      const responseLength = aiResponse.content?.length || 0;
      console.log(aiResponse.content);
      console.log('========================================');
      console.log(`Response length: ${responseLength} characters`);
      console.log(`Finish reason: ${aiResponse.finishReason || 'UNKNOWN'}`);
      
      // Check if response was truncated
      if (aiResponse.finishReason === 'MAX_TOKENS') {
        console.warn('⚠️  WARNING: Response was truncated due to maxTokens limit!');
      } else if (aiResponse.finishReason === 'SAFETY') {
        console.warn('⚠️  WARNING: Response was blocked by safety filters!');
      } else if (aiResponse.finishReason === 'STOP') {
        console.log('✅ Response completed successfully');
      }
      
      console.log('\n--- Token Usage ---');
      console.log(`Input: ${aiResponse.usage.inputTokens}, Output: ${aiResponse.usage.outputTokens}, Total: ${aiResponse.usage.totalTokens}`);
      
      // Check if response might be truncated
      if (aiResponse.usage.outputTokens >= 8000) {
        console.warn('⚠️  WARNING: Response may be truncated (approaching maxTokens limit)');
      }
      
      console.log('----------------------------------------\n');

    } catch (aiError) {
      console.error('❌ AI API error:', aiError);
      
      // Update portfolio status to error (if portfolio was created)
      if (portfolio?.id) {
        await supabase
          .from('portfolios')
          .update({ status: 'error' })
          .eq('id', portfolio.id);
      }

      throw new Error(`AI model error: ${aiError.message}`);
    }

    // Step 9: Parse the AI response (try to extract JSON)
    let parsedResponse = null;
    try {
      // Since we're using responseMimeType: 'application/json', the response should be valid JSON
      // Try parsing directly first, then fall back to regex extraction if needed
      try {
        parsedResponse = JSON.parse(aiResponse.content.trim());
      } catch (directParseError) {
        // Fallback: try to extract JSON from the response (in case of any formatting issues)
        const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        } else {
          throw directParseError;
        }
      }
      
      console.log('\n📊 PARSED TRADING DECISIONS:');
      console.log('========================================');
      console.log(JSON.stringify(parsedResponse, null, 2));
      console.log('========================================\n');
    } catch (parseError) {
      console.warn('⚠️ Could not parse JSON from AI response:', parseError.message);
      console.warn('Response content:', aiResponse.content.substring(0, 500));
    }

    // Step 10: Execute trades if we have valid parsed response
    let executedTrades = [];
    let pendingTrades = [];
    let tradeErrors = [];
    
    // Variables for snapshot creation (need to be accessible after trade processing)
    let finalCash = parseFloat(portfolio.current_cash);
    let finalHoldingsMap = new Map();
    
    // Handle empty trades array (allowed in rebalance mode)
    if (parsedResponse && parsedResponse.trades && Array.isArray(parsedResponse.trades)) {
      if (parsedResponse.trades.length === 0) {
        console.log('\n✅ REBALANCE: No trades recommended');
        console.log('========================================');
        console.log('AI model determined no action is warranted at this time.');
        console.log('Portfolio will remain unchanged.');
        console.log('========================================\n');
        
        // Still create snapshot even with no trades
        // Initialize finalHoldingsMap from current holdings
        if (holdings && holdings.length > 0) {
          holdings.forEach(h => {
            finalHoldingsMap.set(h.ticker, {
              shares: parseFloat(h.shares),
              avg_cost: parseFloat(h.avg_cost),
            });
          });
        }
      }
    }
    
    if (parsedResponse && parsedResponse.trades && Array.isArray(parsedResponse.trades) && parsedResponse.trades.length > 0) {
      console.log('\n💰 PROCESSING TRADES:');
      console.log('========================================');
      
      // Check market status once before processing all trades
      console.log('📊 Checking market status...');
      const marketStatus = await checkMarketStatus();
      const isMarketOpen = marketStatus.isOpen === true;
      
      if (marketStatus.error) {
        console.warn(`⚠️  Market status check failed: ${marketStatus.error}`);
        console.log('   Proceeding with trade execution (assuming market is open)');
      } else {
        console.log(`   Market is ${isMarketOpen ? 'OPEN' : 'CLOSED'}`);
      }
      
      // Get current portfolio state
      let currentCash = parseFloat(portfolio.current_cash);
      const currentHoldings = holdings || [];
      
      // Create a map of current holdings for quick lookup
      const holdingsMap = new Map();
      currentHoldings.forEach(h => {
        holdingsMap.set(h.ticker, {
          shares: parseFloat(h.shares),
          avg_cost: parseFloat(h.avg_cost),
        });
      });
      
      // If market is closed, mark all valid trades as pending
      if (!isMarketOpen) {
        console.log('\n⏸️  Market is closed - marking trades as PENDING');
        console.log('========================================');
        
        for (const trade of parsedResponse.trades) {
          try {
            const { action, ticker, shares, reason } = trade;
            const tickerUpper = ticker?.toUpperCase();
            
            // Validate trade
            if (!tickerUpper || !shares || !action) {
              tradeErrors.push({ trade, error: 'Missing required fields (ticker, shares, action)' });
              continue;
            }
            
            if (shares <= 0) {
              tradeErrors.push({ trade, error: 'Shares must be greater than 0' });
              continue;
            }
            
            // Get current price
            const currentPrice = priceMap.get(tickerUpper);
            if (!currentPrice) {
              tradeErrors.push({ trade, error: `Price not available for ${tickerUpper}` });
              continue;
            }
            
            const tradeShares = parseFloat(shares);
            const tradePrice = currentPrice;
            const totalValue = tradeShares * tradePrice;
            
          // Normalize action to uppercase
          const tradeAction = action.toUpperCase();
          
          // Handle HOLD action (no trade needed)
          if (tradeAction === 'HOLD') {
            console.log(`⏸️  HOLD: ${tickerUpper} - No action taken`);
            continue;
          }
          
          // Validate action type
          const validActions = ['BUY', 'SELL', 'TRIM', 'INCREASE'];
          if (!validActions.includes(tradeAction)) {
            tradeErrors.push({ trade, error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}, or HOLD` });
            continue;
          }
          
          // Map TRIM/INCREASE to SELL/BUY for database storage
          const dbAction = (tradeAction === 'INCREASE' || tradeAction === 'BUY') ? 'buy' : 'sell';
            
            // Record the trade as pending (no executed_at, is_pending=true)
            const { data: tradeRecord, error: tradeError } = await supabase
              .from('orders')
              .insert({
                portfolio_id: portfolio.id,
                ticker: tickerUpper,
                action: dbAction,
                shares: tradeShares,
                price: tradePrice,
                total_value: totalValue,
                reasoning: reason || null,
                is_pending: true,
                executed_at: null, // Explicitly set to null for pending orders
              })
              .select()
              .single();
            
            if (tradeError) {
              tradeErrors.push({ trade, error: `Failed to record pending trade: ${tradeError.message}` });
              continue;
            }
            
            pendingTrades.push({
              ...tradeRecord,
              action: tradeAction,
              ticker: tickerUpper,
              shares: tradeShares,
              price: tradePrice,
              total_value: totalValue,
            });
            
            console.log(`⏸️  PENDING ${tradeAction}: ${tradeShares} shares of ${tickerUpper} @ $${tradePrice.toFixed(2)} = $${totalValue.toFixed(2)}`);
            
          } catch (tradeError) {
            tradeErrors.push({ trade, error: `Trade processing error: ${tradeError.message}` });
            console.error(`❌ Error processing trade:`, tradeError);
          }
        }
        
        // Store final state for snapshot creation (market closed, no changes to cash/holdings)
        finalCash = parseFloat(portfolio.current_cash);
        const currentHoldingsForSnapshot = holdings || [];
        currentHoldingsForSnapshot.forEach(h => {
          finalHoldingsMap.set(h.ticker, {
            shares: parseFloat(h.shares),
            avg_cost: parseFloat(h.avg_cost),
          });
        });
        
        console.log(`\n✅ Marked ${pendingTrades.length} trades as PENDING`);
        if (tradeErrors.length > 0) {
          console.log(`⚠️  ${tradeErrors.length} trades failed:`);
          tradeErrors.forEach(({ trade, error }) => {
            console.log(`  - ${trade.action} ${trade.shares} ${trade.ticker}: ${error}`);
          });
        }
        console.log('========================================\n');
      } else {
        // Market is open - execute trades normally
        console.log('\n✅ Market is open - executing trades');
        console.log('========================================');
        
        // Process each trade
      for (const trade of parsedResponse.trades) {
        try {
          const { action, ticker, shares, reason } = trade;
          const tickerUpper = ticker?.toUpperCase();
          
          // Validate trade
          if (!tickerUpper || !shares || !action) {
            tradeErrors.push({ trade, error: 'Missing required fields (ticker, shares, action)' });
            continue;
          }
          
          if (shares <= 0) {
            tradeErrors.push({ trade, error: 'Shares must be greater than 0' });
            continue;
          }
          
          // Get current price
          const currentPrice = priceMap.get(tickerUpper);
          if (!currentPrice) {
            tradeErrors.push({ trade, error: `Price not available for ${tickerUpper}` });
            continue;
          }
          
          const tradeShares = parseFloat(shares);
          const tradePrice = currentPrice;
          const totalValue = tradeShares * tradePrice;
          
          // Normalize action to uppercase
          const tradeAction = action.toUpperCase();
          
          // Handle HOLD action (no trade needed)
          if (tradeAction === 'HOLD') {
            console.log(`✅ HOLD: ${tickerUpper} - No action taken`);
            continue;
          }
          
          // Validate action type
          const validActions = ['BUY', 'SELL', 'TRIM', 'INCREASE'];
          if (!validActions.includes(tradeAction)) {
            tradeErrors.push({ trade, error: `Invalid action: ${action}. Must be one of: ${validActions.join(', ')}, or HOLD` });
            continue;
          }
          
          // Map TRIM/INCREASE to SELL/BUY for processing
          const isBuy = tradeAction === 'BUY' || tradeAction === 'INCREASE';
          const isSell = tradeAction === 'SELL' || tradeAction === 'TRIM';
          
          if (isBuy) {
            // Check if we have enough cash
            if (totalValue > currentCash) {
              tradeErrors.push({ 
                trade, 
                error: `Insufficient cash. Need $${totalValue.toFixed(2)}, have $${currentCash.toFixed(2)}` 
              });
              continue;
            }
            
            // Check minimum trade value
            if (totalValue < 500) {
              tradeErrors.push({ trade, error: `Trade value $${totalValue.toFixed(2)} is below minimum $500` });
              continue;
            }
            
            // Record the trade (market is open, so execute immediately)
            // Map TRIM/INCREASE to buy/sell for database storage
            const dbAction = 'buy';
            const { data: tradeRecord, error: tradeError } = await supabase
              .from('orders')
              .insert({
                portfolio_id: portfolio.id,
                ticker: tickerUpper,
                action: dbAction,
                shares: tradeShares,
                price: tradePrice,
                total_value: totalValue,
                reasoning: reason || null,
                is_pending: false,
                executed_at: new Date().toISOString(),
              })
              .select()
              .single();
            
            if (tradeError) {
              tradeErrors.push({ trade, error: `Failed to record trade: ${tradeError.message}` });
              continue;
            }
            
            // Update or create holding
            const existingHolding = holdingsMap.get(tickerUpper);
            
            if (existingHolding) {
              // Update existing holding - calculate new average cost
              const existingShares = existingHolding.shares;
              const existingCost = existingHolding.avg_cost;
              const existingTotalCost = existingShares * existingCost;
              const newTotalCost = existingTotalCost + totalValue;
              const newTotalShares = existingShares + tradeShares;
              const newAvgCost = newTotalCost / newTotalShares;
              
              const { error: updateError } = await supabase
                .from('holdings')
                .update({
                  shares: newTotalShares,
                  avg_cost: newAvgCost,
                  updated_at: new Date().toISOString(),
                })
                .eq('portfolio_id', portfolio.id)
                .eq('ticker', tickerUpper);
              
              if (updateError) {
                tradeErrors.push({ trade, error: `Failed to update holding: ${updateError.message}` });
                continue;
              }
              
              holdingsMap.set(tickerUpper, {
                shares: newTotalShares,
                avg_cost: newAvgCost,
              });
            } else {
              // Create new holding
              const { error: insertError } = await supabase
                .from('holdings')
                .insert({
                  portfolio_id: portfolio.id,
                  ticker: tickerUpper,
                  shares: tradeShares,
                  avg_cost: tradePrice,
                });
              
              if (insertError) {
                tradeErrors.push({ trade, error: `Failed to create holding: ${insertError.message}` });
                continue;
              }
              
              holdingsMap.set(tickerUpper, {
                shares: tradeShares,
                avg_cost: tradePrice,
              });
            }
            
            // Update cash
            currentCash -= totalValue;
            
            executedTrades.push({
              ...tradeRecord,
              action: tradeAction, // Keep original action (BUY or INCREASE)
              ticker: tickerUpper,
              shares: tradeShares,
              price: tradePrice,
              total_value: totalValue,
            });
            
            const actionLabel = tradeAction === 'INCREASE' ? 'INCREASE' : 'BUY';
            console.log(`✅ ${actionLabel}: ${tradeShares} shares of ${tickerUpper} @ $${tradePrice.toFixed(2)} = $${totalValue.toFixed(2)}`);
            
          } else if (isSell) {
            // Check if we have enough shares
            const existingHolding = holdingsMap.get(tickerUpper);
            
            if (!existingHolding || existingHolding.shares < tradeShares) {
              const available = existingHolding ? existingHolding.shares : 0;
              tradeErrors.push({ 
                trade, 
                error: `Insufficient shares. Need ${tradeShares}, have ${available}` 
              });
              continue;
            }
            
            // Record the trade (market is open, so execute immediately)
            // Map TRIM/INCREASE to buy/sell for database storage
            const dbAction = 'sell';
            const { data: tradeRecord, error: tradeError } = await supabase
              .from('orders')
              .insert({
                portfolio_id: portfolio.id,
                ticker: tickerUpper,
                action: dbAction,
                shares: tradeShares,
                price: tradePrice,
                total_value: totalValue,
                reasoning: reason || null,
                is_pending: false,
                executed_at: new Date().toISOString(),
              })
              .select()
              .single();
            
            if (tradeError) {
              tradeErrors.push({ trade, error: `Failed to record trade: ${tradeError.message}` });
              continue;
            }
            
            // Update or delete holding
            const remainingShares = existingHolding.shares - tradeShares;
            
            if (remainingShares > 0.0001) { // Keep holding if there are remaining shares (accounting for floating point)
              const { error: updateError } = await supabase
                .from('holdings')
                .update({
                  shares: remainingShares,
                  // avg_cost stays the same when selling
                  updated_at: new Date().toISOString(),
                })
                .eq('portfolio_id', portfolio.id)
                .eq('ticker', tickerUpper);
              
              if (updateError) {
                tradeErrors.push({ trade, error: `Failed to update holding: ${updateError.message}` });
                continue;
              }
              
              holdingsMap.set(tickerUpper, {
                shares: remainingShares,
                avg_cost: existingHolding.avg_cost,
              });
            } else {
              // Delete holding if no shares remaining
              const { error: deleteError } = await supabase
                .from('holdings')
                .delete()
                .eq('portfolio_id', portfolio.id)
                .eq('ticker', tickerUpper);
              
              if (deleteError) {
                tradeErrors.push({ trade, error: `Failed to delete holding: ${deleteError.message}` });
                continue;
              }
              
              holdingsMap.delete(tickerUpper);
            }
            
            // Update cash
            currentCash += totalValue;
            
            executedTrades.push({
              ...tradeRecord,
              action: tradeAction, // Keep original action (SELL or TRIM)
              ticker: tickerUpper,
              shares: tradeShares,
              price: tradePrice,
              total_value: totalValue,
            });
            
            const actionLabel = tradeAction === 'TRIM' ? 'TRIM' : 'SELL';
            console.log(`✅ ${actionLabel}: ${tradeShares} shares of ${tickerUpper} @ $${tradePrice.toFixed(2)} = $${totalValue.toFixed(2)}`);
            
          } else {
            // This should not happen due to validation above, but keep as fallback
            tradeErrors.push({ trade, error: `Invalid action: ${action}. Must be one of: BUY, SELL, TRIM, INCREASE, or HOLD` });
            continue;
          }
          
        } catch (tradeError) {
          tradeErrors.push({ trade, error: `Trade execution error: ${tradeError.message}` });
          console.error(`❌ Error executing trade:`, tradeError);
        }
      }
      
        // Update portfolio cash and last_traded_at (only if trades were executed)
        if (executedTrades.length > 0) {
          const { error: updateCashError } = await supabase
            .from('portfolios')
            .update({
              current_cash: currentCash,
              last_traded_at: new Date().toISOString(),
            })
            .eq('id', portfolio.id);
          
          if (updateCashError) {
            console.error('❌ Failed to update portfolio cash:', updateCashError);
          } else {
            portfolio.current_cash = currentCash;
            console.log(`\n💰 Updated portfolio cash: $${currentCash.toFixed(2)}`);
          }
        }
        
        // Store final state for snapshot creation
        finalCash = executedTrades.length > 0 ? currentCash : parseFloat(portfolio.current_cash);
        finalHoldingsMap = holdingsMap;
        
        console.log(`\n✅ Executed ${executedTrades.length} trades successfully`);
        if (tradeErrors.length > 0) {
          console.log(`⚠️  ${tradeErrors.length} trades failed:`);
          tradeErrors.forEach(({ trade, error }) => {
            console.log(`  - ${trade.action} ${trade.shares} ${trade.ticker}: ${error}`);
          });
        }
        console.log('========================================\n');
      }
    } else {
      console.log('⚠️  No valid trades to execute (parsedResponse.trades is missing or invalid)');
      
      // Initialize finalHoldingsMap from existing holdings for snapshot
      const currentHoldings = holdings || [];
      currentHoldings.forEach(h => {
        finalHoldingsMap.set(h.ticker, {
          shares: parseFloat(h.shares),
          avg_cost: parseFloat(h.avg_cost),
        });
      });
    }

    // Step 10: Create initial portfolio snapshot
    // Create a snapshot after trades are processed (executed or pending)
    // This captures the portfolio state after the initial trades
    await createInitialPortfolioSnapshot(
      supabase,
      portfolio,
      assetType,
      cryptoAssets,
      finalHoldingsMap,
      finalCash,
      priceMap
    );

    // Step 11: Update portfolio status to active and refresh portfolio data
    const { data: updatedPortfolio, error: updateError } = await supabase
      .from('portfolios')
      .update({ status: 'active' })
      .eq('id', portfolio.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update portfolio status:', updateError);
    }

    // Refresh holdings after trades
    const { data: updatedHoldings } = await supabase
      .from('holdings')
      .select('ticker, shares, avg_cost')
      .eq('portfolio_id', portfolio.id);

      console.log('\n✅ PORTFOLIO INITIALIZATION COMPLETE');
      console.log('========================================\n');

      return NextResponse.json({
        success: true,
        portfolio: updatedPortfolio || portfolio,
        holdings: updatedHoldings || [],
        trades: {
          executed: executedTrades,
          pending: pendingTrades,
          errors: tradeErrors,
          totalExecuted: executedTrades.length,
          totalPending: pendingTrades.length,
          totalErrors: tradeErrors.length,
        },
        aiResponse: {
          content: aiResponse.content,
          parsed: parsedResponse,
          usage: aiResponse.usage,
        },
      });
    } else {
      // Non-AI portfolio: Just create the portfolio without AI initialization
      console.log('\n📝 Creating manual trading portfolio (no AI)');
      console.log('========================================\n');
      
      // Build portfolio insert object
      const portfolioData = {
        user_id: userId,
        name: name.trim(),
        type: 'ai_simulation',
        asset_type: assetType,
        ai_model: null,
        starting_capital: startingCapital,
        current_cash: startingCapital,
        status: 'active',
        crypto_assets: cryptoAssets,
        portfolio_type: assetType === 'crypto' ? 'trading' : 'investing', // Crypto portfolios are for trading
      };
      
      // Only add rebalance fields for stock portfolios (crypto doesn't need rebalancing)
      if (assetType === 'stock') {
        // Calculate next rebalance date (1 month from today for monthly cadence)
        const today = new Date();
        const nextRebalanceDate = new Date(today);
        nextRebalanceDate.setMonth(nextRebalanceDate.getMonth() + 1);
        const year = nextRebalanceDate.getFullYear();
        const month = String(nextRebalanceDate.getMonth() + 1).padStart(2, '0');
        const day = String(nextRebalanceDate.getDate()).padStart(2, '0');
        const nextRebalanceDateStr = `${year}-${month}-${day}`;
        
        portfolioData.rebalance_cadence = 'monthly';
        portfolioData.next_rebalance_date = nextRebalanceDateStr;
        portfolioData.previous_rebalance_date = null;
      }
      
      const { data: portfolio, error: insertError } = await supabase
        .from('portfolios')
        .insert(portfolioData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Database insert error:', insertError);
        throw new Error(`Failed to create portfolio: ${insertError.message}`);
      }

      console.log(`✅ Portfolio created with ID: ${portfolio.id}`);
      
      // Create initial portfolio snapshot for non-AI portfolios
      // No holdings at creation, so pass empty Map and starting capital as cash
      await createInitialPortfolioSnapshot(
        supabase,
        portfolio,
        assetType,
        cryptoAssets,
        new Map(), // No holdings yet
        startingCapital, // Starting cash
        new Map() // No price map needed since no holdings
      );

      return NextResponse.json({
        success: true,
        portfolio: portfolio,
        holdings: [],
        trades: {
          executed: [],
          pending: [],
          errors: [],
          totalExecuted: 0,
          totalPending: 0,
          totalErrors: 0,
        },
        aiResponse: null,
      });
    }

  } catch (error) {
    console.error('❌ Portfolio initialization failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize portfolio' },
      { status: 500 }
    );
  }
}

