/**
 * GET /api/crypto/candles
 * 
 * Fetches crypto candle data for charting, scoped to portfolio creation date.
 * 
 * Query params:
 * - productId: e.g. "BTC-USD"
 * - portfolioId: UUID of the portfolio
 * - range: "1D" | "1W" | "1M" | "3M" | "ALL"
 * 
 * Returns:
 * {
 *   timeframe: string,
 *   startTime: ISO string,
 *   endTime: ISO string,
 *   points: [{ time: ISO string, value: number }]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getChartQuery, formatDateForQuery, ChartRange } from '../../../../utils/chartRange';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use service role key to bypass RLS (server-side)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const portfolioId = searchParams.get('portfolioId');
    const range = searchParams.get('range') as ChartRange;
    
    if (!productId) {
      return NextResponse.json(
        { error: 'Missing required parameter: productId' },
        { status: 400 }
      );
    }
    
    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Missing required parameter: portfolioId' },
        { status: 400 }
      );
    }
    
    if (!range || !['1D', '1W', '1M', '3M', 'ALL'].includes(range)) {
      return NextResponse.json(
        { error: 'Invalid range. Must be one of: 1D, 1W, 1M, 3M, ALL' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    // Fetch portfolio to get created_at timestamp
    const { data: portfolio, error: portfolioError } = await supabase
      .from('portfolios')
      .select('created_at')
      .eq('id', portfolioId)
      .single();
    
    if (portfolioError || !portfolio) {
      console.error('Error fetching portfolio:', portfolioError);
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }
    
    const portfolioCreatedAt = new Date(portfolio.created_at);
    const now = new Date();
    
    // Get chart query parameters (timeframe, startTime, endTime)
    const chartQuery = getChartQuery({
      productId,
      portfolioCreatedAt,
      range,
      now,
    });
    
    // Query crypto_candles
    let query = supabase
      .from('crypto_candles')
      .select('time, close')
      .eq('product_id', productId)
      .eq('timeframe', chartQuery.timeframe)
      .gte('time', formatDateForQuery(chartQuery.startTime))
      .lte('time', formatDateForQuery(chartQuery.endTime))
      .order('time', { ascending: true });
    
    // Apply maxPoints limit if specified
    if (chartQuery.maxPoints) {
      query = query.limit(chartQuery.maxPoints);
    }
    
    const { data: candles, error: candlesError } = await query;
    
    if (candlesError) {
      console.error('Error fetching candles:', candlesError);
      return NextResponse.json(
        { error: `Failed to fetch candles: ${candlesError.message}` },
        { status: 500 }
      );
    }
    
    // Normalize points for chart: { time: ISOString, value: close }
    const points = (candles || []).map(candle => ({
      time: candle.time,
      value: parseFloat(candle.close),
    }));
    
    // Handle edge cases
    if (points.length === 0) {
      // New portfolio or no data yet - return empty array
      // UI should show "Waiting for live data..."
      return NextResponse.json({
        timeframe: chartQuery.timeframe,
        startTime: chartQuery.startTime.toISOString(),
        endTime: chartQuery.endTime.toISOString(),
        points: [],
        message: 'No candle data available yet',
      });
    }
    
    return NextResponse.json({
      timeframe: chartQuery.timeframe,
      startTime: chartQuery.startTime.toISOString(),
      endTime: chartQuery.endTime.toISOString(),
      points,
    });
    
  } catch (error: any) {
    console.error('Error in crypto candles API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch crypto candles' },
      { status: 500 }
    );
  }
}

