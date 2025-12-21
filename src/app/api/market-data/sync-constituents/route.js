/**
 * API Route to sync NASDAQ-100 constituents
 * 
 * Scrapes the latest NASDAQ-100 list from the official NASDAQ website
 * and logs the results.
 * 
 * GET /api/market-data/sync-constituents
 * 
 * Can be called manually or scheduled via cron/automation
 */

import { NextResponse } from 'next/server';
import { syncNasdaq100Constituents } from '../../../../lib/marketData';

export async function GET(request) {
  try {
    console.log('\n========================================');
    console.log('🔄 SYNCING NASDAQ-100 CONSTITUENTS');
    console.log('========================================');

    const result = await syncNasdaq100Constituents();

    console.log(`✅ Successfully synced ${result.count} tickers`);
    console.log(`📅 Last updated: ${result.lastUpdated}`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      ...result,
      message: `Successfully synced ${result.count} NASDAQ-100 constituents`,
    });

  } catch (error) {
    console.error('❌ Error syncing NASDAQ-100 constituents:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to sync constituents',
      },
      { status: 500 }
    );
  }
}

