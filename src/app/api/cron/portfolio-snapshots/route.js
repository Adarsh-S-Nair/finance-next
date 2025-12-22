/**
 * Portfolio Snapshots Cron Job
 * 
 * This endpoint is called daily by Vercel cron to create snapshots of all portfolios.
 * It calculates the current value of each portfolio (cash + holdings) and creates
 * a snapshot in the ai_portfolio_snapshots table.
 * 
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/portfolio-snapshots",
 *     "schedule": "30 14 * * *"  // 2:30 PM UTC = 9:30 AM EST daily
 *   }]
 * }
 * 
 * Note: Vercel cron uses UTC time. 9:30 AM EST = 14:30 UTC (2:30 PM UTC)
 * During daylight saving time (EDT), this will run at 10:30 AM local time.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calculatePortfolioValue, formatDateString } from '../../../../lib/portfolioUtils';

// Mark route as dynamic to avoid build-time analysis
export const dynamic = 'force-dynamic';

// Lazy create Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request) {
  // Verify cron secret if set (for security)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseClient();
    const snapshotDate = formatDateString(new Date());
    
    console.log(`\n📸 PORTFOLIO SNAPSHOTS CRON JOB`);
    console.log('========================================');
    console.log(`Snapshot Date: ${snapshotDate}`);
    console.log('========================================\n');

    // Step 1: Fetch all active portfolios
    const { data: portfolios, error: portfoliosError } = await supabase
      .from('ai_portfolios')
      .select('id, current_cash, name')
      .eq('status', 'active');
    
    if (portfoliosError) {
      console.error('❌ Error fetching portfolios:', portfoliosError);
      throw new Error(`Failed to fetch portfolios: ${portfoliosError.message}`);
    }
    
    if (!portfolios || portfolios.length === 0) {
      console.log('ℹ️  No active portfolios found');
      return NextResponse.json({
        success: true,
        message: 'No active portfolios to snapshot',
        snapshotsCreated: 0,
        snapshotsSkipped: 0,
        date: snapshotDate,
      });
    }
    
    console.log(`📊 Found ${portfolios.length} active portfolios\n`);

    // Step 2: Check which portfolios already have snapshots for today
    const portfolioIds = portfolios.map(p => p.id);
    const { data: existingSnapshots, error: existingError } = await supabase
      .from('ai_portfolio_snapshots')
      .select('portfolio_id')
      .in('portfolio_id', portfolioIds)
      .eq('snapshot_date', snapshotDate);
    
    if (existingError) {
      console.error('⚠️  Error checking existing snapshots:', existingError);
      // Continue anyway - we'll handle duplicates with unique constraint
    }
    
    const existingPortfolioIds = new Set(
      (existingSnapshots || []).map(s => s.portfolio_id)
    );
    
    // Filter out portfolios that already have snapshots for today
    const portfoliosToSnapshot = portfolios.filter(
      p => !existingPortfolioIds.has(p.id)
    );
    
    console.log(`   ${portfoliosToSnapshot.length} portfolios need snapshots`);
    console.log(`   ${existingPortfolioIds.size} portfolios already have snapshots for today\n`);

    if (portfoliosToSnapshot.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All portfolios already have snapshots for today',
        snapshotsCreated: 0,
        snapshotsSkipped: existingPortfolioIds.size,
        date: snapshotDate,
      });
    }

    // Step 3: Fetch holdings for all portfolios that need snapshots
    const { data: allHoldings, error: holdingsError } = await supabase
      .from('ai_portfolio_holdings')
      .select('portfolio_id, ticker, shares, avg_cost')
      .in('portfolio_id', portfoliosToSnapshot.map(p => p.id));
    
    if (holdingsError) {
      console.error('❌ Error fetching holdings:', holdingsError);
      throw new Error(`Failed to fetch holdings: ${holdingsError.message}`);
    }
    
    // Group holdings by portfolio_id
    const holdingsByPortfolio = new Map();
    (allHoldings || []).forEach(holding => {
      if (!holdingsByPortfolio.has(holding.portfolio_id)) {
        holdingsByPortfolio.set(holding.portfolio_id, []);
      }
      holdingsByPortfolio.get(holding.portfolio_id).push(holding);
    });

    // Step 4: Fetch current stock prices for all unique tickers
    const allTickers = [...new Set((allHoldings || []).map(h => h.ticker.toUpperCase()))];
    const stockQuotes = {};
    
    if (allTickers.length > 0) {
      console.log(`📈 Fetching current prices for ${allTickers.length} tickers...`);
      
      // Fetch quotes in batches of 50 (API limit)
      const batchSize = 50;
      for (let i = 0; i < allTickers.length; i += batchSize) {
        const batch = allTickers.slice(i, i + batchSize);
        const tickerList = batch.join(',');
        
        try {
          // Use internal API call - construct URL properly for server-side
          // In Vercel, use VERCEL_URL; otherwise use NEXT_PUBLIC_APP_URL or localhost
          let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
          if (!baseUrl) {
            if (process.env.VERCEL_URL) {
              baseUrl = `https://${process.env.VERCEL_URL}`;
            } else {
              baseUrl = 'http://localhost:3000';
            }
          }
          const quotesRes = await fetch(
            `${baseUrl}/api/market-data/quotes?tickers=${tickerList}`
          );
          
          if (quotesRes.ok) {
            const quotesData = await quotesRes.json();
            Object.assign(stockQuotes, quotesData.quotes || {});
          } else {
            console.warn(`⚠️  Failed to fetch quotes for batch ${Math.floor(i / batchSize) + 1}`);
          }
        } catch (quoteError) {
          console.warn(`⚠️  Error fetching quotes for batch ${Math.floor(i / batchSize) + 1}:`, quoteError.message);
        }
      }
      
      console.log(`   Fetched prices for ${Object.keys(stockQuotes).length} tickers\n`);
    }

    // Step 5: Calculate portfolio values and create snapshots
    const snapshotsToInsert = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const portfolio of portfoliosToSnapshot) {
      try {
        const holdings = holdingsByPortfolio.get(portfolio.id) || [];
        
        // Prepare stock quotes map for this portfolio's holdings
        const portfolioQuotes = {};
        holdings.forEach(h => {
          const ticker = h.ticker.toUpperCase();
          if (stockQuotes[ticker]) {
            portfolioQuotes[ticker] = stockQuotes[ticker];
          }
        });
        
        // Calculate portfolio value
        const { totalValue, cash, holdingsValue } = calculatePortfolioValue(
          portfolio.current_cash,
          holdings,
          portfolioQuotes
        );
        
        snapshotsToInsert.push({
          portfolio_id: portfolio.id,
          total_value: totalValue,
          cash: cash,
          holdings_value: holdingsValue,
          snapshot_date: snapshotDate,
        });
        
        console.log(`✅ ${portfolio.name}: $${totalValue.toFixed(2)} (Cash: $${cash.toFixed(2)}, Holdings: $${holdingsValue.toFixed(2)})`);
      } catch (error) {
        console.error(`❌ Error calculating value for portfolio ${portfolio.id}:`, error);
        errorCount++;
      }
    }
    
    // Step 6: Insert snapshots (using upsert to handle race conditions)
    if (snapshotsToInsert.length > 0) {
      console.log(`\n💾 Inserting ${snapshotsToInsert.length} snapshots...`);
      
      const { data: insertedSnapshots, error: insertError } = await supabase
        .from('ai_portfolio_snapshots')
        .upsert(snapshotsToInsert, {
          onConflict: 'portfolio_id,snapshot_date',
          ignoreDuplicates: false,
        })
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting snapshots:', insertError);
        throw new Error(`Failed to insert snapshots: ${insertError.message}`);
      }
      
      successCount = insertedSnapshots?.length || 0;
      console.log(`✅ Successfully created ${successCount} snapshots\n`);
    }

    console.log('========================================');
    console.log(`✅ CRON JOB COMPLETE`);
    console.log(`   Snapshots created: ${successCount}`);
    console.log(`   Snapshots skipped: ${existingPortfolioIds.size}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      message: 'Portfolio snapshots created successfully',
      snapshotsCreated: successCount,
      snapshotsSkipped: existingPortfolioIds.size,
      errors: errorCount,
      date: snapshotDate,
    });

  } catch (error) {
    console.error('❌ Portfolio snapshots cron job failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to create portfolio snapshots' 
      },
      { status: 500 }
    );
  }
}

