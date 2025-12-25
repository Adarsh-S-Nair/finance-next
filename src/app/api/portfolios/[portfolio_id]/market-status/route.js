import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Mark route as dynamic
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

// Fetch Alpaca market clock
async function fetchAlpacaClock(apiKey, secretKey) {
  try {
    const response = await fetch('https://paper-api.alpaca.markets/v2/clock', {
      method: 'GET',
      headers: {
        'APCA-API-KEY-ID': apiKey,
        'APCA-API-SECRET-KEY': secretKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Alpaca API error: ${response.status} - ${errorText}`);
    }

    const clockData = await response.json();
    return { success: true, clock: clockData };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function GET(request, { params }) {
  try {
    const supabase = getSupabaseClient();
    const { portfolio_id } = await params;

    if (!portfolio_id) {
      return NextResponse.json(
        { error: 'Missing portfolio_id' },
        { status: 400 }
      );
    }

    // Fetch portfolio to get Alpaca credentials
    const { data: portfolio, error: portfolioError } = await supabase
      .from('ai_portfolios')
      .select('id, is_alpaca_connected, alpaca_api_key, alpaca_secret_key')
      .eq('id', portfolio_id)
      .single();

    if (portfolioError) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    // Only fetch market status for Alpaca-connected portfolios
    if (!portfolio.is_alpaca_connected) {
      return NextResponse.json(
        { error: 'This portfolio is not connected to Alpaca' },
        { status: 400 }
      );
    }

    if (!portfolio.alpaca_api_key || !portfolio.alpaca_secret_key) {
      return NextResponse.json(
        { error: 'Alpaca credentials not found for this portfolio' },
        { status: 400 }
      );
    }

    // Fetch market clock from Alpaca
    const clockResult = await fetchAlpacaClock(
      portfolio.alpaca_api_key,
      portfolio.alpaca_secret_key
    );

    if (!clockResult.success) {
      return NextResponse.json(
        { error: `Failed to fetch market status: ${clockResult.error}` },
        { status: 500 }
      );
    }

    const clock = clockResult.clock;

    // Return market status
    return NextResponse.json({
      is_open: clock.is_open || false,
      next_open: clock.next_open || null,
      next_close: clock.next_close || null,
      timestamp: clock.timestamp || null,
    });
  } catch (error) {
    console.error('Error fetching market status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch market status' },
      { status: 500 }
    );
  }
}

