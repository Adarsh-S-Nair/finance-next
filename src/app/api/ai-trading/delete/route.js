/**
 * Delete a paper trading portfolio
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

export async function DELETE(request) {
  try {
    const userId = requireVerifiedUserId(request);

    // Gate: ai_trading is a Pro feature
    const supabase = getSupabaseClient();
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();
    if (!canAccess(userProfile?.subscription_tier || 'free', 'ai_trading')) {
      return NextResponse.json({ error: 'feature_locked', feature: 'ai_trading' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId');

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Missing portfolioId parameter' },
        { status: 400 }
      );
    }

    // Verify the portfolio exists, is the right type, and belongs to this user
    const { data: portfolio, error: fetchError } = await supabase
      .from('portfolios')
      .select('id, type, user_id')
      .eq('id', portfolioId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !portfolio) {
      return NextResponse.json(
        { error: 'Portfolio not found' },
        { status: 404 }
      );
    }

    if (portfolio.type !== 'ai_simulation' && portfolio.type !== 'arbitrage_simulation') {
      return NextResponse.json(
        { error: 'Can only delete paper trading portfolios' },
        { status: 403 }
      );
    }

    // Delete related data in order (due to foreign key constraints)
    // 1. Delete orders
    await supabase
      .from('orders')
      .delete()
      .eq('portfolio_id', portfolioId);

    // 2. Delete holdings
    await supabase
      .from('holdings')
      .delete()
      .eq('portfolio_id', portfolioId);

    // 3. Delete portfolio snapshots
    await supabase
      .from('portfolio_snapshots')
      .delete()
      .eq('portfolio_id', portfolioId);

    // 4. Delete exchange balances (for arbitrage portfolios)
    await supabase
      .from('exchange_balances')
      .delete()
      .eq('portfolio_id', portfolioId);

    // 5. Delete arbitrage trades (for arbitrage portfolios)
    await supabase
      .from('arbitrage_trades')
      .delete()
      .eq('portfolio_id', portfolioId);

    // 6. Finally delete the portfolio
    const { error: deleteError } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', portfolioId);

    if (deleteError) {
      console.error('Failed to delete portfolio:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete portfolio' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Delete portfolio error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete portfolio' },
      { status: 500 }
    );
  }
}
