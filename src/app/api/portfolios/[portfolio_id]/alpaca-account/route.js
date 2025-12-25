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

// Fetch Alpaca account data
async function fetchAlpacaAccount(apiKey, secretKey) {
  try {
    const response = await fetch('https://paper-api.alpaca.markets/v2/account', {
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

    const accountData = await response.json();
    return { success: true, account: accountData };
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
      .select('id, user_id, is_alpaca_connected, alpaca_api_key, alpaca_secret_key')
      .eq('id', portfolio_id)
      .single();

    if (portfolioError) {
      console.error('Portfolio fetch error:', portfolioError);
      return NextResponse.json(
        { error: 'Portfolio not found', details: portfolioError.message },
        { status: 404 }
      );
    }

    console.log('Portfolio found:', {
      id: portfolio.id,
      is_alpaca_connected: portfolio.is_alpaca_connected,
      has_api_key: !!portfolio.alpaca_api_key,
      has_secret_key: !!portfolio.alpaca_secret_key,
    });

    // Only fetch Alpaca data if this is an Alpaca-connected portfolio
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

    // Fetch live account data from Alpaca
    const accountResult = await fetchAlpacaAccount(
      portfolio.alpaca_api_key,
      portfolio.alpaca_secret_key
    );

    if (!accountResult.success) {
      console.error('Alpaca API error:', accountResult.error);
      return NextResponse.json(
        { error: `Failed to fetch Alpaca account: ${accountResult.error}` },
        { status: 500 }
      );
    }

    console.log('Alpaca account fetched successfully');

    const account = accountResult.account;

    // Return account data according to Alpaca docs:
    // - equity: total equity (cash + positions)
    // - portfolio_value: total portfolio value (same as equity)
    // - cash: available cash
    // - last_equity: balance at last market close
    return NextResponse.json({
      equity: parseFloat(account.equity) || 0,
      portfolio_value: parseFloat(account.portfolio_value) || parseFloat(account.equity) || 0,
      cash: parseFloat(account.cash) || 0,
      last_equity: parseFloat(account.last_equity) || 0,
      buying_power: parseFloat(account.buying_power) || 0,
      // Include other useful fields
      account_number: account.account_number,
      status: account.status,
      currency: account.currency,
      pattern_day_trader: account.pattern_day_trader || false,
      trading_blocked: account.trading_blocked || false,
    });
  } catch (error) {
    console.error('Error fetching Alpaca account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Alpaca account' },
      { status: 500 }
    );
  }
}

