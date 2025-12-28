/**
 * Prune Crypto Candles Cron Job
 * 
 * This endpoint is called daily by Vercel cron to delete old crypto candles
 * based on retention policies:
 *   - 1m candles: keep for 48 hours
 *   - 5m candles: keep for 14 days
 *   - 1h candles: keep for 90 days
 *   - 1d candles: keep for 5 years
 * 
 * Vercel Cron Configuration (vercel.json):
 * {
 *   "crons": [{
 *     "path": "/api/cron/prune-crypto-candles",
 *     "schedule": "0 2 * * *"  // 2 AM UTC daily
 *   }]
 * }
 */

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

export async function GET(request) {
  // Verify cron secret if set (for security)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseClient();
    
    console.log('\n🧹 PRUNE CRYPTO CANDLES CRON JOB');
    console.log('========================================');
    console.log(`Started at: ${new Date().toISOString()}`);
    console.log('========================================\n');

    // Call the prune function
    const { data, error } = await supabase.rpc('prune_crypto_candles');

    if (error) {
      console.error('❌ Error pruning crypto candles:', error);
      throw new Error(`Failed to prune crypto candles: ${error.message}`);
    }

      // Log results
      if (data && data.length > 0) {
        console.log('📊 Pruning Results:');
        data.forEach((row) => {
          console.log(`   ${row.timeframe_type}: Deleted ${row.deleted_count} candles (cutoff: ${new Date(row.cutoff_time).toISOString()})`);
        });
      } else {
        console.log('ℹ️  No candles were deleted (or function returned no results)');
      }

    const totalDeleted = data?.reduce((sum, row) => sum + (parseInt(row.deleted_count) || 0), 0) || 0;

    console.log('\n========================================');
    console.log(`✅ CRON JOB COMPLETE`);
    console.log(`   Total candles deleted: ${totalDeleted}`);
    console.log('========================================\n');

    return NextResponse.json({
      success: true,
      message: 'Crypto candles pruned successfully',
      totalDeleted,
      results: data || [],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Prune crypto candles cron job failed:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to prune crypto candles' 
      },
      { status: 500 }
    );
  }
}

