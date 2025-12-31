/**
 * Log trading decisions from backtest simulation
 * This endpoint logs decisions to server console for debugging
 */

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { symbol, timestamp, decision, reason, details } = body;

    // Only log actionable decisions (BUY/SELL), skip HOLD
    if (decision === 'HOLD') {
      return NextResponse.json({ success: true, skipped: true });
    }

    // Log to server console
    const logMessage = `[BACKTEST] ${timestamp} | ${symbol} | Decision: ${decision} | Reason: ${reason}`;

    if (decision === 'BUY') {
      console.log(`✅ ${logMessage}`, details || '');
    } else if (decision === 'SELL') {
      console.log(`🔴 ${logMessage}`, details || '');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging decision:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to log decision' },
      { status: 500 }
    );
  }
}



