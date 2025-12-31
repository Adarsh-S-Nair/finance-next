/**
 * Evaluate a trading tick using the engine logic
 * This runs server-side and logs decisions to console
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Dynamic import of engine modules (CommonJS)
function loadEngineModules() {
  const path = require('path');
  const enginePath = path.join(process.cwd(), 'engine', 'src');
  
  try {
    // Use require for CommonJS modules
    const { computeIndicators } = require(path.join(enginePath, 'indicators', 'indicators'));
    const { evaluateEntrySignal } = require(path.join(enginePath, 'strategy', 'signalEvaluator'));
    const { RiskManager } = require(path.join(enginePath, 'risk', 'riskManager'));
    const { getDefaultEngineConfig } = require(path.join(enginePath, 'config', 'engineConfig'));
    
    return { computeIndicators, evaluateEntrySignal, RiskManager, getDefaultEngineConfig };
  } catch (error) {
    console.error('Failed to load engine modules:', error);
    throw error;
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      symbol, 
      timestamp, 
      candles5m, 
      candles1h, 
      portfolioState 
    } = body;

    // Debug: Log that API was called
    console.log(`🔍 [BACKTEST] API called for ${symbol} at ${timestamp} (${candles5m?.length || 0} 5m candles, ${candles1h?.length || 0} 1h candles)`);

    // Load engine modules (synchronous require)
    const { computeIndicators, evaluateEntrySignal, RiskManager, getDefaultEngineConfig } = loadEngineModules();
    const config = getDefaultEngineConfig();

    // Convert candle format from client to engine format
    // Engine expects: { timestamp: Date, open, high, low, close, volume }
    const convertCandles = (candles) => {
      if (!candles || !Array.isArray(candles)) return [];
      return candles.map(c => ({
        timestamp: c.time ? new Date(c.time) : new Date(c.timestamp),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume || 0,
      }));
    };

    const converted5m = convertCandles(candles5m);
    const converted1h = convertCandles(candles1h);

    // Get latest candles
    const latest5mCandle = converted5m.length > 0 ? converted5m[converted5m.length - 1] : null;
    const latest1hCandle = converted1h.length > 0 ? converted1h[converted1h.length - 1] : null;

    if (!latest5mCandle || !latest1hCandle) {
      const decision = 'HOLD';
      const reason = 'MISSING_CANDLES';
      console.log(`⏸️  [BACKTEST] ${timestamp} | ${symbol} | Decision: ${decision} | Reason: ${reason}`);
      return NextResponse.json({ decision, reason });
    }

    // Compute indicators
    const indicatorResult = computeIndicators({
      candles5m: converted5m,
      candles1h: converted1h,
      config,
    });

    if (!indicatorResult.ok) {
      const decision = 'HOLD';
      const reason = indicatorResult.reason || 'INDICATORS_NOT_READY';
      console.log(`⏸️  [BACKTEST] ${timestamp} | ${symbol} | Decision: ${decision} | Reason: ${reason}`);
      return NextResponse.json({ decision, reason });
    }

    // Check risk constraints
    const riskManager = new RiskManager(config);
    const riskCheck = riskManager.canOpenPosition({
      portfolio: {
        equity: portfolioState.equity || 100000,
        cash_balance: portfolioState.cash || 100000,
      },
      openPositionsCount: portfolioState.openPositionsCount || 0,
      todayRealizedPnl: portfolioState.dailyPnL || 0,
      lastStopOutAt: portfolioState.lastStopOutAt ? new Date(portfolioState.lastStopOutAt) : null,
      now: new Date(timestamp),
    });

    if (!riskCheck.allowed) {
      const decision = 'HOLD';
      const reason = `BLOCKED_BY_RISK: ${riskCheck.reason}`;
      console.log(`⏸️  [BACKTEST] ${timestamp} | ${symbol} | Decision: ${decision} | Reason: ${reason}`);
      return NextResponse.json({ decision, reason, riskDetails: riskCheck.details });
    }

    // Evaluate entry signal
    const signalResult = evaluateEntrySignal({
      latest5mCandle,
      latest1hCandle,
      indicators: indicatorResult,
      config,
    });

    const decision = signalResult.action;
    const reason = signalResult.reason;

    // Log ALL decisions to server console with full details
    if (decision === 'BUY') {
      console.log(`✅ [BACKTEST] ${timestamp} | ${symbol} | Decision: ${decision} | Reason: ${reason}`, {
        price: latest5mCandle.close,
        ema20_5m: indicatorResult.values.ema20_5m,
        rsi14_5m: indicatorResult.values.rsi14_5m,
        ema200_1h: indicatorResult.values.ema200_1h,
        ema200Slope: indicatorResult.values.ema200Slope,
      });
    } else {
      // Log ALL HOLD decisions with full context
      console.log(`⏸️  [BACKTEST] ${timestamp} | ${symbol} | Decision: ${decision} | Reason: ${reason}`, {
        price: latest5mCandle.close,
        ema20_5m: indicatorResult.values.ema20_5m,
        rsi14_5m: indicatorResult.values.rsi14_5m,
        ema200_1h: indicatorResult.values.ema200_1h,
        ema200Slope: indicatorResult.values.ema200Slope,
        debug: signalResult.debug || {},
      });
    }

    return NextResponse.json({
      decision,
      reason,
      indicators: indicatorResult.values,
      debug: signalResult.debug,
    });
  } catch (error) {
    console.error('Error evaluating tick:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to evaluate tick', decision: 'HOLD', reason: 'ERROR' },
      { status: 500 }
    );
  }
}

