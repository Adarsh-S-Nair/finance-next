/**
 * Initialize a new arbitrage simulation portfolio
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireVerifiedUserId } from '../../../../lib/api/auth';
import { canAccess } from '../../../../lib/tierConfig';

export const dynamic = 'force-dynamic';

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Valid exchanges
const VALID_EXCHANGES = ['binance', 'coinbase', 'kraken', 'kucoin', 'bybit', 'okx'];
const VALID_CRYPTOS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK'];

export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);
    const supabase = getSupabaseClient();

    // Gate: arbitrage is a Pro feature
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    if (!canAccess(userProfile?.subscription_tier || 'free', 'arbitrage')) {
      return NextResponse.json({ error: 'feature_locked', feature: 'arbitrage' }, { status: 403 });
    }

    const body = await request.json();

    const {
      name,
      startingCapital,
      exchanges, // Array of exchange IDs
      cryptos, // Array of crypto symbols
    } = body;

    // Validate required fields
    if (!name || !startingCapital) {
      return NextResponse.json(
        { error: 'Missing required fields: name, startingCapital' },
        { status: 400 }
      );
    }

    // Validate exchanges
    if (!exchanges || !Array.isArray(exchanges) || exchanges.length < 2) {
      return NextResponse.json(
        { error: 'Must select at least 2 exchanges for arbitrage' },
        { status: 400 }
      );
    }

    const validExchanges = exchanges.filter(e => VALID_EXCHANGES.includes(e.toLowerCase()));
    if (validExchanges.length < 2) {
      return NextResponse.json(
        { error: `Invalid exchanges. Valid options: ${VALID_EXCHANGES.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate cryptos
    if (!cryptos || !Array.isArray(cryptos) || cryptos.length === 0) {
      return NextResponse.json(
        { error: 'Must select at least 1 cryptocurrency' },
        { status: 400 }
      );
    }

    const validCryptos = cryptos.filter(c => VALID_CRYPTOS.includes(c.toUpperCase()));
    if (validCryptos.length === 0) {
      return NextResponse.json(
        { error: `Invalid cryptocurrencies. Valid options: ${VALID_CRYPTOS.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate starting capital
    if (startingCapital < 1000) {
      return NextResponse.json(
        { error: 'Starting capital must be at least $1,000' },
        { status: 400 }
      );
    }

    console.log('\n========================================');
    console.log('🔄 INITIALIZING ARBITRAGE PORTFOLIO');
    console.log('========================================');
    console.log(`Portfolio: ${name}`);
    console.log(`Starting Capital: $${startingCapital.toLocaleString()}`);
    console.log(`Exchanges: ${validExchanges.join(', ')}`);
    console.log(`Cryptos: ${validCryptos.join(', ')}`);
    console.log('----------------------------------------');

    // Calculate initial capital distribution (equal across exchanges)
    const capitalPerExchange = startingCapital / validExchanges.length;

    // Create the portfolio
    const { data: portfolio, error: insertError } = await supabase
      .from('portfolios')
      .insert({
        user_id: userId,
        name: name.trim(),
        type: 'arbitrage_simulation',
        asset_type: 'crypto',
        starting_capital: startingCapital,
        current_cash: startingCapital,
        status: 'active',
        crypto_assets: validCryptos,
        portfolio_type: 'arbitrage',
        // Store config in metadata
        metadata: {
          exchanges: validExchanges,
          capitalPerExchange: capitalPerExchange,
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create portfolio:', insertError);
      return NextResponse.json(
        { error: 'Failed to create portfolio' },
        { status: 500 }
      );
    }

    console.log(`✅ Portfolio created: ${portfolio.id}`);

    // Create exchange balances for each exchange
    const exchangeBalances = validExchanges.map(exchange => ({
      portfolio_id: portfolio.id,
      exchange: exchange,
      currency: 'USD',
      balance: capitalPerExchange,
    }));

    const { error: balanceError } = await supabase
      .from('exchange_balances')
      .insert(exchangeBalances);

    if (balanceError) {
      console.warn('Could not create exchange balances:', balanceError.message);
      // Not critical - continue anyway
    } else {
      console.log(`✅ Created ${exchangeBalances.length} exchange balances`);
    }

    // Create initial snapshot
    const { data: snapshotData, error: snapshotError } = await supabase
      .from('portfolio_snapshots')
      .insert({
        portfolio_id: portfolio.id,
        total_value: startingCapital,
        cash: startingCapital,
        holdings_value: 0,
        snapshot_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (snapshotError) {
      console.error('❌ Failed to create initial snapshot:', snapshotError.message);
    } else {
      console.log(`✅ Created initial snapshot: $${startingCapital.toLocaleString()} on ${snapshotData.snapshot_date}`);
    }

    console.log('========================================');
    console.log('✅ ARBITRAGE PORTFOLIO READY');
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      portfolio: {
        ...portfolio,
        exchangeBalances: exchangeBalances,
      },
    });

  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Arbitrage initialization error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize portfolio' },
      { status: 500 }
    );
  }
}
