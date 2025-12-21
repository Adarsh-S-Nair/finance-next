/**
 * API Route to sync NASDAQ-100 constituents
 * 
 * Fetches the latest NASDAQ-100 list from market data API
 * and saves it to the local data file.
 * 
 * GET /api/market-data/sync-constituents
 * 
 * Can be called manually or scheduled via cron/automation
 */

import { NextResponse } from 'next/server';
import { syncNasdaq100Constituents } from '../../../../lib/marketData';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

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
        hint: error.message.includes('API key')
          ? 'Make sure you have set one of: POLYGON_API_KEY, IEX_CLOUD_API_KEY, or FMP_API_KEY in your environment variables'
          : undefined,
      },
      { status: 500 }
    );
  }
}

