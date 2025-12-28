/**
 * Get crypto candles for charting
 * Fetches candle data from crypto_candles table for specified products and timeframes
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Try service role key first (bypasses RLS), fallback to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const products = searchParams.get('products'); // Comma-separated: BTC-USD,ETH-USD
    const timeframe = searchParams.get('timeframe') || '1m'; // 1m, 5m, 1h, 1d
    const startTime = searchParams.get('startTime'); // ISO timestamp
    const endTime = searchParams.get('endTime'); // ISO timestamp
    
    if (!products) {
      return NextResponse.json(
        { error: 'Missing required parameter: products' },
        { status: 400 }
      );
    }

    const productList = products.split(',').map(p => p.trim()).filter(Boolean);
    if (productList.length === 0) {
      return NextResponse.json(
        { error: 'No valid products provided' },
        { status: 400 }
      );
    }

    // Validate timeframe
    const validTimeframes = ['1m', '5m', '1h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      return NextResponse.json(
        { error: `Invalid timeframe. Must be one of: ${validTimeframes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    console.log('=== CRYPTO CANDLES API ===');
    console.log('Query params:', { products, timeframe, startTime, endTime });
    console.log('Product list:', productList);

    // Build query
    let query = supabase
      .from('crypto_candles')
      .select('product_id, timeframe, time, open, high, low, close, volume')
      .in('product_id', productList)
      .eq('timeframe', timeframe);

    // Add time filters if provided
    if (startTime) {
      query = query.gte('time', startTime);
    }
    if (endTime) {
      query = query.lte('time', endTime);
    }

    // Order by time ascending
    query = query.order('time', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching crypto candles:', error);
      return NextResponse.json(
        { error: `Failed to fetch crypto candles: ${error.message}` },
        { status: 500 }
      );
    }

    console.log('Query result:', {
      dataLength: data?.length || 0,
      sampleData: data?.slice(0, 3),
      error: error?.message
    });

    // Group candles by product_id
    const candlesByProduct = {};
    productList.forEach(product => {
      candlesByProduct[product] = [];
    });

    if (data && data.length > 0) {
      data.forEach(candle => {
        if (candlesByProduct[candle.product_id]) {
          candlesByProduct[candle.product_id].push({
            time: candle.time,
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close),
            volume: parseFloat(candle.volume) || 0,
          });
        }
      });
    } else {
      console.log('No data returned from query');
    }

    console.log('Grouped candles:', Object.keys(candlesByProduct).map(key => ({
      product: key,
      count: candlesByProduct[key].length,
      sample: candlesByProduct[key][0]
    })));
    console.log('=== END CRYPTO CANDLES API ===');

    return NextResponse.json({
      candles: candlesByProduct,
      timeframe,
      products: productList,
    });

  } catch (error) {
    console.error('Error in crypto candles API:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch crypto candles' },
      { status: 500 }
    );
  }
}

