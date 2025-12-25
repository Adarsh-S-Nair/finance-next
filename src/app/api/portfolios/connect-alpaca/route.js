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

// Test Alpaca API connection
async function testAlpacaConnection(apiKey, secretKey) {
  try {
    // Use Alpaca's accounts endpoint to verify credentials
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

export async function POST(request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();
    const { userId, name, apiKey, secretKey } = body;

    // Validate required fields
    if (!userId || !name || !apiKey || !secretKey) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, name, apiKey, secretKey' },
        { status: 400 }
      );
    }

    // Test Alpaca connection
    console.log('Testing Alpaca API connection...');
    const connectionTest = await testAlpacaConnection(apiKey, secretKey);
    
    if (!connectionTest.success) {
      return NextResponse.json(
        { error: `Failed to connect to Alpaca: ${connectionTest.error}` },
        { status: 400 }
      );
    }

    console.log('✅ Alpaca connection successful');

    // Get account balance from Alpaca
    // According to Alpaca docs:
    // - account.equity: total equity (cash + positions)
    // - account.portfolio_value: total portfolio value (same as equity)
    // - account.cash: available cash
    const account = connectionTest.account;
    const accountBalance = parseFloat(account.cash) || 0;
    const portfolioValue = parseFloat(account.equity) || parseFloat(account.portfolio_value) || accountBalance;

    // Create portfolio in database
    const { data: portfolio, error: insertError } = await supabase
      .from('ai_portfolios')
      .insert({
        user_id: userId,
        name: name.trim(),
        is_alpaca_connected: true,
        ai_model: null, // Not needed for Alpaca portfolios
        starting_capital: portfolioValue,
        current_cash: accountBalance,
        status: 'active',
        alpaca_api_key: apiKey,
        alpaca_secret_key: secretKey,
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Database insert error:', insertError);
      throw new Error(`Failed to create portfolio: ${insertError.message}`);
    }

    console.log(`✅ Alpaca portfolio created with ID: ${portfolio.id}`);

    return NextResponse.json({
      portfolio,
      account: {
        cash: accountBalance,
        portfolioValue: portfolioValue,
      },
    });
  } catch (error) {
    console.error('Error connecting Alpaca account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect Alpaca account' },
      { status: 500 }
    );
  }
}

