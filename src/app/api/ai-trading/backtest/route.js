import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase/admin';
import { requireVerifiedUserId } from '../../../../lib/api/auth';
import { canAccess } from '../../../../lib/tierConfig';

export async function POST(request) {
  try {
    const userId = requireVerifiedUserId(request);

    // Gate: ai_trading is a Pro feature
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    if (!canAccess(userProfile?.subscription_tier || 'free', 'ai_trading')) {
      return NextResponse.json({ error: 'feature_locked', feature: 'ai_trading' }, { status: 403 });
    }

    const body = await request.json();
    const {
      startingCapital,
      assetType,
      cryptoAssets,
      startDate,
      endDate,
    } = body;

    if (!startingCapital || !assetType || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (assetType !== 'crypto') {
      return NextResponse.json(
        { error: 'Backtest is currently only supported for crypto portfolios' },
        { status: 400 }
      );
    }

    if (!cryptoAssets || cryptoAssets.length === 0) {
      return NextResponse.json(
        { error: 'At least one crypto asset is required' },
        { status: 400 }
      );
    }

    // Parse dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start >= end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    if (end > now) {
      return NextResponse.json(
        { error: 'End date cannot be in the future' },
        { status: 400 }
      );
    }

    // TODO: Implement actual backtest logic using historical data from the engine
    // For now, return empty results - the UI is set up but simulation is not implemented yet
    
    // Generate empty snapshots (just start and end dates for the chart)
    const snapshots = [
      {
        date: startDate,
        value: parseFloat(startingCapital),
        cash: parseFloat(startingCapital),
        holdings_value: 0,
      },
      {
        date: endDate,
        value: parseFloat(startingCapital),
        cash: parseFloat(startingCapital),
        holdings_value: 0,
      },
    ];

    // Empty trades array - no simulation run yet
    const trades = [];

    // Empty holdings array - no simulation run yet
    const holdings = [];

    // Calculate final metrics (no change since no simulation)
    const finalValue = parseFloat(startingCapital);
    const totalReturn = 0;
    const totalReturnPercent = 0;

    return NextResponse.json({
      success: true,
      backtest: {
        startDate: startDate,
        endDate: endDate,
        startingCapital: parseFloat(startingCapital),
        finalValue: finalValue,
        totalReturn: totalReturn,
        totalReturnPercent: totalReturnPercent,
        snapshots: snapshots,
        trades: trades,
        holdings: holdings,
        assetType: assetType,
        cryptoAssets: cryptoAssets || [],
      },
    });
  } catch (error) {
    console.error('Error running backtest:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run backtest' },
      { status: 500 }
    );
  }
}

