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

export async function POST(request) {
  try {
    // Create Supabase client (lazy, only when actually needed)
    const supabase = getSupabaseClient();
    
    const body = await request.json();
    const { userId, name, aiModel, startingCapital } = body;

    // Validate required fields
    if (!userId || !name || !aiModel || !startingCapital) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name, aiModel, startingCapital' },
        { status: 400 }
      );
    }

    console.log('\n========================================');
    console.log('🚀 INITIALIZING AI PORTFOLIO');
    console.log('========================================');
    console.log(`Portfolio: ${name}`);
    console.log(`AI Model: ${aiModel}`);
    console.log(`Starting Capital: $${startingCapital.toLocaleString()}`);
    console.log('----------------------------------------');

    // Step 1: Scrape Nasdaq 100 constituents from website (first step of workflow)
    console.log('\n📊 STEP 1: SCRAPING NASDAQ-100 CONSTITUENTS');
    console.log('========================================');
    
    const constituents = await scrapeNasdaq100Constituents();
    console.log(`✅ Scraped ${constituents.length} Nasdaq 100 constituents from website`);
    
    // Extract ticker symbols
    const activeTickers = constituents.map(c => c.ticker);
    console.log(`Extracted ${activeTickers.length} ticker symbols`);
    
    // Step 2: Check existing tickers in database
    console.log('\n💾 STEP 2: CHECKING EXISTING TICKERS IN DATABASE');
    console.log('========================================');
    const tickerSymbols = constituents.map(c => c.ticker);
    const { data: existingTickers, error: fetchError } = await supabase
      .from('tickers')
      .select('symbol, logo, name, sector')
      .in('symbol', tickerSymbols);
    
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
    
    // Identify tickers that need to be fetched (don't have logo or missing data)
    const tickersToFetch = constituents.filter(c => {
      const existing = existingTickersMap.get(c.ticker);
      // Fetch if: no existing record, or no logo, or missing name/sector
      return !existing || !existing.logo || !existing.name || !existing.sector;
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
    const tickerInserts = constituents.map(c => {
      const existingTicker = existingTickersMap.get(c.ticker);
      const tickerDetail = tickerDetailsMap.get(c.ticker);
      
      // Use existing data if available, otherwise use fetched data, otherwise fall back to scraped name
      const name = existingTicker?.name || tickerDetail?.name || c.name || null;
      const sector = existingTicker?.sector || tickerDetail?.sector || null;
      const domain = tickerDetail?.domain || null;
      
      // Preserve existing logo if it exists, otherwise generate from domain
      let logo = null;
      if (existingTicker?.logo && existingTicker.logo.trim() !== '') {
        // Preserve existing logo
        logo = existingTicker.logo;
      } else if (domain) {
        // Generate logo URL from domain using logo.dev
        const logoDevPublicKey = process.env.LOGO_DEV_PUBLIC_KEY;
        if (logoDevPublicKey) {
          logo = `https://img.logo.dev/${domain}?token=${logoDevPublicKey}`;
        }
      }
      
      return {
        symbol: c.ticker,
        name: name,
        sector: sector,
        logo: logo,
      };
    });
    
    // Upsert tickers into the tickers table
    const { data: insertedTickers, error: tickerError } = await supabase
      .from('tickers')
      .upsert(tickerInserts, {
        onConflict: 'symbol',
        ignoreDuplicates: false, // Update if exists
      })
      .select();
    
    if (tickerError) {
      console.warn('⚠️  Could not store tickers in database:', tickerError.message);
    } else {
      const withName = tickerInserts.filter(t => t.name).length;
      const withSector = tickerInserts.filter(t => t.sector).length;
      const withLogo = tickerInserts.filter(t => t.logo).length;
      const withDomain = tickerInserts.filter(t => {
        const tickerDetail = tickerDetailsMap.get(t.symbol);
        return tickerDetail?.domain;
      }).length;
      console.log(`✅ Stored/updated ${insertedTickers?.length || tickerInserts.length} tickers in database`);
      console.log(`   - ${withName} with company names`);
      console.log(`   - ${withSector} with sector information`);
      console.log(`   - ${withDomain} with domain information`);
      console.log(`   - ${withLogo} with logo URLs`);
    }
    console.log('========================================\n');
    
    // Step 5: Fetch stock price data for AI prompt (separate from ticker details)
    console.log('\n📊 STEP 5: FETCHING STOCK PRICE DATA FOR AI PROMPT');
    console.log('========================================');
    
    const stockData = await fetchBulkStockData(activeTickers);
    
    // Separate successful fetches from errors
    const successfulData = stockData.filter(d => !d.error);
    const failedTickers = stockData.filter(d => d.error);
    
    if (failedTickers.length > 0) {
      console.log(`\n⚠️  Failed to fetch price data for ${failedTickers.length} tickers:`);
      failedTickers.forEach(d => {
        console.log(`  - ${d.ticker}: ${d.error}`);
      });
    }
    
    console.log(`✅ Successfully fetched price data for ${successfulData.length} stocks\n`);
    
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
    
    const stockDataForPrompt = formatStockDataForPrompt(successfulData);
    
    // Print to logs for debugging
    console.log('\n📈 STOCK DATA SUMMARY:');
    console.log('========================================');
    console.log(`Total stocks with data: ${successfulData.length}`);
    console.log(`Failed tickers: ${failedTickers.length}`);
    console.log('========================================\n');

    // Step 4: Create the portfolio in the database
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
      .from('ai_portfolios')
      .insert({
        user_id: userId,
        name: name.trim(),
        ai_model: aiModel,
        starting_capital: startingCapital,
        current_cash: startingCapital,
        status: 'initializing', // Start in initializing state
        rebalance_cadence: 'monthly', // Default to monthly for all new portfolios
        next_rebalance_date: nextRebalanceDateStr,
        previous_rebalance_date: null, // No previous rebalance for new portfolio
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      throw new Error(`Failed to create portfolio: ${insertError.message}`);
    }

    console.log(`✅ Portfolio created with ID: ${portfolio.id}`);

    // Step 5: Fetch current portfolio holdings (if any)
    const { data: holdings, error: holdingsError } = await supabase
      .from('ai_portfolio_holdings')
      .select('ticker, shares, avg_cost')
      .eq('portfolio_id', portfolio.id);
    
    if (holdingsError) {
      console.warn('⚠️  Could not fetch holdings:', holdingsError.message);
    }
    
    // Format holdings for prompt
    const formatHoldingsForPrompt = (holdings) => {
      if (!holdings || holdings.length === 0) {
        return '\nCurrent Portfolio Holdings: None (new portfolio)\n';
      }
      
      let formatted = `\nCurrent Portfolio Holdings (${holdings.length} positions):\n\n`;
      formatted += 'Ticker | Shares | Avg Cost | Total Value\n';
      formatted += '-'.repeat(50) + '\n';
      
      let totalHoldingsValue = 0;
      holdings.forEach(holding => {
        const currentPrice = successfulData.find(s => s.ticker === holding.ticker)?.currentPrice;
        const totalValue = currentPrice ? (holding.shares * currentPrice) : (holding.shares * holding.avg_cost);
        totalHoldingsValue += totalValue;
        
        const price = currentPrice ? currentPrice.toFixed(2) : holding.avg_cost.toFixed(2);
        formatted += `${holding.ticker.padEnd(6)} | ${holding.shares.toFixed(4).padStart(8)} | $${holding.avg_cost.toFixed(2).padStart(8)} | $${totalValue.toFixed(2).padStart(12)}\n`;
      });
      
      formatted += '-'.repeat(50) + '\n';
      formatted += `Total Holdings Value: $${totalHoldingsValue.toFixed(2)}\n`;
      
      return formatted;
    };
    
    const holdingsForPrompt = formatHoldingsForPrompt(holdings);

    // Step 6: Load and fill the trading prompt
    const tradingPrompt = loadPrompt('trading');
    
    // Build the user prompt with stock data and holdings included
    const baseUserPrompt = fillTemplate(tradingPrompt.user, {
      name: name,
      starting_capital: startingCapital.toLocaleString(),
      current_cash: portfolio.current_cash.toLocaleString(),
    });
    
    // Append holdings and stock data to the prompt
    const userPrompt = baseUserPrompt + '\n' + holdingsForPrompt + '\n' + stockDataForPrompt;

    // Log the complete prompt before sending
    console.log('\n📝 COMPLETE PROMPT TO BE SENT TO AI:');
    console.log('========================================');
    console.log('--- System Prompt ---');
    console.log(tradingPrompt.system);
    console.log('\n--- User Prompt (with stock data) ---');
    console.log(userPrompt);
    console.log('========================================\n');

    // Step 7: Call the AI model
    let aiResponse;
    try {
      if (aiModel.startsWith('gemini')) {
        // Increase maxTokens to ensure we get the full response
        aiResponse = await callGemini(
          aiModel,
          tradingPrompt.system,
          userPrompt,
          { temperature: 0.7, maxTokens: 4000 }
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
      if (aiResponse.usage.outputTokens >= 3990) {
        console.warn('⚠️  WARNING: Response may be truncated (approaching maxTokens limit)');
      }
      
      console.log('----------------------------------------\n');

    } catch (aiError) {
      console.error('❌ AI API error:', aiError);
      
      // Update portfolio status to error (if portfolio was created)
      if (portfolio?.id) {
        await supabase
          .from('ai_portfolios')
          .update({ status: 'error' })
          .eq('id', portfolio.id);
      }

      throw new Error(`AI model error: ${aiError.message}`);
    }

    // Step 8: Parse the AI response (try to extract JSON)
    let parsedResponse = null;
    try {
      // Try to extract JSON from the response
      const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
        console.log('\n📊 PARSED TRADING DECISIONS:');
        console.log('========================================');
        console.log(JSON.stringify(parsedResponse, null, 2));
        console.log('========================================\n');
      }
    } catch (parseError) {
      console.warn('⚠️ Could not parse JSON from AI response:', parseError.message);
    }

    // Step 9: Execute trades if we have valid parsed response
    let executedTrades = [];
    let pendingTrades = [];
    let tradeErrors = [];
    
    // Variables for snapshot creation (need to be accessible after trade processing)
    let finalCash = parseFloat(portfolio.current_cash);
    let finalHoldingsMap = new Map();
    const priceMap = new Map();
    
    // Create a map of stock prices for quick lookup (used for both trades and snapshot)
    successfulData.forEach(stock => {
      if (stock.currentPrice) {
        priceMap.set(stock.ticker, stock.currentPrice);
      }
    });
    
    if (parsedResponse && parsedResponse.trades && Array.isArray(parsedResponse.trades)) {
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
            
            // Normalize action to lowercase
            const tradeAction = action.toUpperCase();
            
            if (tradeAction !== 'BUY' && tradeAction !== 'SELL') {
              tradeErrors.push({ trade, error: `Invalid action: ${action}. Must be BUY or SELL` });
              continue;
            }
            
            // Record the trade as pending (no executed_at, is_pending=true)
            const { data: tradeRecord, error: tradeError } = await supabase
              .from('ai_portfolio_trades')
              .insert({
                portfolio_id: portfolio.id,
                ticker: tickerUpper,
                action: tradeAction.toLowerCase(),
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
          
          // Normalize action to lowercase
          const tradeAction = action.toUpperCase();
          
          if (tradeAction === 'BUY') {
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
            const { data: tradeRecord, error: tradeError } = await supabase
              .from('ai_portfolio_trades')
              .insert({
                portfolio_id: portfolio.id,
                ticker: tickerUpper,
                action: 'buy',
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
                .from('ai_portfolio_holdings')
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
                .from('ai_portfolio_holdings')
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
              action: 'BUY',
              ticker: tickerUpper,
              shares: tradeShares,
              price: tradePrice,
              total_value: totalValue,
            });
            
            console.log(`✅ BUY: ${tradeShares} shares of ${tickerUpper} @ $${tradePrice.toFixed(2)} = $${totalValue.toFixed(2)}`);
            
          } else if (tradeAction === 'SELL') {
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
            const { data: tradeRecord, error: tradeError } = await supabase
              .from('ai_portfolio_trades')
              .insert({
                portfolio_id: portfolio.id,
                ticker: tickerUpper,
                action: 'sell',
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
                .from('ai_portfolio_holdings')
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
                .from('ai_portfolio_holdings')
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
              action: 'SELL',
              ticker: tickerUpper,
              shares: tradeShares,
              price: tradePrice,
              total_value: totalValue,
            });
            
            console.log(`✅ SELL: ${tradeShares} shares of ${tickerUpper} @ $${tradePrice.toFixed(2)} = $${totalValue.toFixed(2)}`);
            
          } else {
            tradeErrors.push({ trade, error: `Invalid action: ${action}. Must be BUY or SELL` });
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
            .from('ai_portfolios')
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
    console.log('\n📸 CREATING INITIAL PORTFOLIO SNAPSHOT');
    console.log('========================================');
    
    // Calculate holdings value using current prices
    let holdingsValue = 0;
    for (const [ticker, holding] of finalHoldingsMap.entries()) {
      const currentPrice = priceMap.get(ticker);
      if (currentPrice) {
        holdingsValue += holding.shares * currentPrice;
      } else {
        // Fall back to avg_cost if price not available
        holdingsValue += holding.shares * holding.avg_cost;
      }
    }
    
    const totalValue = finalCash + holdingsValue;
    const snapshotDate = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    console.log(`   Cash: $${finalCash.toFixed(2)}`);
    console.log(`   Holdings Value: $${holdingsValue.toFixed(2)}`);
    console.log(`   Total Value: $${totalValue.toFixed(2)}`);
    console.log(`   Snapshot Date: ${snapshotDate}`);
    
    const { data: snapshotData, error: snapshotError } = await supabase
      .from('ai_portfolio_snapshots')
      .insert({
        portfolio_id: portfolio.id,
        total_value: totalValue,
        cash: finalCash,
        holdings_value: holdingsValue,
        snapshot_date: snapshotDate,
      })
      .select()
      .single();
    
    if (snapshotError) {
      console.error('❌ Failed to create portfolio snapshot:', snapshotError);
    } else {
      console.log(`✅ Created initial portfolio snapshot (ID: ${snapshotData.id})`);
    }
    console.log('========================================\n');

    // Step 11: Update portfolio status to active and refresh portfolio data
    const { data: updatedPortfolio, error: updateError } = await supabase
      .from('ai_portfolios')
      .update({ status: 'active' })
      .eq('id', portfolio.id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Failed to update portfolio status:', updateError);
    }

    // Refresh holdings after trades
    const { data: updatedHoldings } = await supabase
      .from('ai_portfolio_holdings')
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

  } catch (error) {
    console.error('❌ Portfolio initialization failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize portfolio' },
      { status: 500 }
    );
  }
}

