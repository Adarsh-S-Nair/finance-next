/**
 * Market Status API - Checks if US stock market is open
 * 
 * GET /api/market-data/status
 * 
 * Returns current market status from FinnHub API
 */

import { NextResponse } from 'next/server';
import { checkMarketStatus } from '../../../../lib/marketData';

export async function GET(request) {
  try {
    const status = await checkMarketStatus();
    
    return NextResponse.json(status);
  } catch (error) {
    console.error('Market status API error:', error);
    return NextResponse.json(
      { 
        isOpen: false,
        error: 'Internal server error' 
      },
      { status: 500 }
    );
  }
}

