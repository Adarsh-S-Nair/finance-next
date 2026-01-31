/**
 * Delete a paper trading portfolio
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    const { searchParams } = new URL(request.url);
    const portfolioId = searchParams.get('portfolioId');

    if (!portfolioId) {
      return NextResponse.json(
        { error: 'Missing portfolioId parameter' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    // Verify the portfolio exists and is an ai_simulation type
    const { data: portfolio, error: fetchError } = await supabase
      .from('portfolios')
      .select('id, type')
      .eq('id', portfolioId)
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
    console.error('Delete portfolio error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete portfolio' },
      { status: 500 }
    );
  }
}
