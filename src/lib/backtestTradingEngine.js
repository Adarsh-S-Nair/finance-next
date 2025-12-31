/**
 * Client-Side Trading Engine for Backtesting
 * 
 * IMPORTANT: This file imports core trading logic from engine/src/core/
 * to ensure IDENTICAL behavior between backtest and production engine.
 */

// Import core trading logic from engine (SINGLE SOURCE OF TRUTH)
import { ENGINE_CONFIG } from '../../engine/src/core/config.js';
import { computeIndicators } from '../../engine/src/core/indicators.js';
import { evaluateEntrySignal } from '../../engine/src/core/signalEvaluator.js';

/**
 * Log trading decision to server (non-blocking)
 * Only logs BUY and SELL decisions (not HOLD)
 */
async function logDecisionToServer(symbol, timestamp, decision, reason, details) {
  // Only log actionable decisions
  if (decision === 'HOLD') return;

  try {
    fetch('/api/ai-trading/backtest/log-decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, timestamp, decision, reason, details }),
    }).catch(() => { });
  } catch (error) {
    // Ignore errors - logging is optional
  }
}

/**
 * Risk Manager
 */
class RiskManager {
  constructor(config) {
    this.config = config;
  }

  canOpenPosition({ portfolio, openPositionsCount, todayRealizedPnl, lastStopOutAt, now }) {
    if (!portfolio || portfolio.equity <= 0) {
      return { allowed: false, reason: "INSUFFICIENT_EQUITY" };
    }

    if (openPositionsCount >= this.config.risk.maxOpenPositions) {
      return { allowed: false, reason: "MAX_POSITIONS" };
    }

    const maxOutflowDollars = portfolio.equity * this.config.risk.maxDailyNetOutflowPct;
    if (typeof todayRealizedPnl === "number" && todayRealizedPnl <= -maxOutflowDollars) {
      return { allowed: false, reason: "DAILY_OUTFLOW_LIMIT" };
    }

    // Cooldown check
    if (lastStopOutAt) {
      const cooldownWindowMs = this.config.risk.cooldownBarsAfterStop * 5 * 60 * 1000; // 5m candles
      const timeSinceStopOut = now.getTime() - lastStopOutAt.getTime();
      if (timeSinceStopOut < cooldownWindowMs) {
        return { allowed: false, reason: "COOLDOWN" };
      }
    }

    return { allowed: true };
  }

  computePositionSize({ equity, entryPrice, stopPrice, cashBalance }) {
    if (equity <= 0 || entryPrice <= 0 || stopPrice <= 0) {
      return { ok: false, reason: "INVALID_INPUT" };
    }

    const availableCash = cashBalance >= 0 ? cashBalance : equity;
    const perUnitRisk = Math.abs(entryPrice - stopPrice);
    if (perUnitRisk <= 0) {
      return { ok: false, reason: "INVALID_STOP" };
    }

    const riskDollars = equity * this.config.risk.riskPerTradePct;
    let quantity = riskDollars / perUnitRisk;

    const maxAffordableQty = availableCash / entryPrice;
    const finalQty = Math.min(quantity, maxAffordableQty);

    if (!Number.isFinite(finalQty) || finalQty <= 0) {
      return { ok: false, reason: "INVALID_QUANTITY" };
    }

    return {
      ok: true,
      quantity: finalQty,
      riskDollars,
      perUnitRisk,
    };
  }
}

/**
 * Backtest Trading Engine
 */
export class BacktestTradingEngine {
  constructor(startingCapital, config = ENGINE_CONFIG) {
    this.config = config;
    this.cash = startingCapital;
    this.startingCapital = startingCapital;
    this.positions = new Map(); // symbol -> { quantity, entryPrice, stopPrice, takeProfitPrice, entryTime }
    this.trades = []; // Array of completed trades
    this.orders = []; // Array of all orders (buy and sell)
    this.lastStopOutAt = null;
    this.dailyPnL = 0; // Track daily P&L for risk management
    this.currentDay = null;

    // Candle buffers for indicators
    this.candles5m = new Map(); // productId -> array of candles
    this.candles1h = new Map(); // productId -> array of candles
  }

  /**
   * Add a candle and update buffers
   */
  addCandle(candle, timeframe) {
    const productId = candle.productId;

    if (timeframe === '5m') {
      if (!this.candles5m.has(productId)) {
        this.candles5m.set(productId, []);
      }
      const buffer = this.candles5m.get(productId);
      buffer.push(candle);
      // Keep only last 500 candles (was 100)
      if (buffer.length > 500) {
        buffer.shift();
      }
    } else if (timeframe === '1h') {
      if (!this.candles1h.has(productId)) {
        this.candles1h.set(productId, []);
      }
      const buffer = this.candles1h.get(productId);
      buffer.push(candle);
      // Keep only last 1000 candles (was 260) - enough for ~41 days
      if (buffer.length > 1000) {
        buffer.shift();
      }
    }
  }

  /**
   * Check and close positions based on stop loss or take profit
   */
  checkExits(timestamp, prices) {
    const closedTrades = [];
    const timeStr = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    for (const [symbol, position] of this.positions.entries()) {
      const currentPrice = prices[symbol];
      if (!currentPrice) continue;

      let exitReason = null;
      let exitPrice = currentPrice;

      // Check stop loss
      if (currentPrice <= position.stopPrice) {
        exitReason = 'stop';
        exitPrice = position.stopPrice;
      }
      // Check take profit
      else if (currentPrice >= position.takeProfitPrice) {
        exitReason = 'take_profit';
        exitPrice = position.takeProfitPrice;
      }

      if (exitReason) {
        const trade = this.closePosition(symbol, exitPrice, timestamp, exitReason);
        if (trade) {
          closedTrades.push(trade);
          if (exitReason === 'stop') {
            this.lastStopOutAt = timestamp;
            console.log(
              `%c🛑 ${timeStr} | ${trade.ticker} | STOP LOSS HIT | Entry: $${trade.entry_price.toFixed(2)} → Exit: $${trade.exit_price.toFixed(2)} | P&L: $${trade.realized_pnl.toFixed(2)}`,
              'color: #ef4444; font-weight: bold; background: #ef444420; padding: 2px 6px; border-radius: 4px'
            );
          } else {
            console.log(
              `%c🎯 ${timeStr} | ${trade.ticker} | TAKE PROFIT HIT | Entry: $${trade.entry_price.toFixed(2)} → Exit: $${trade.exit_price.toFixed(2)} | P&L: +$${trade.realized_pnl.toFixed(2)}`,
              'color: #10b981; font-weight: bold; background: #10b98120; padding: 2px 6px; border-radius: 4px'
            );
          }
          // Log exit decision to server (fire and forget)
          logDecisionToServer(
            trade.ticker,
            trade.exit_date,
            'SELL',
            exitReason,
            {
              entry_price: trade.entry_price,
              exit_price: trade.exit_price,
              realized_pnl: trade.realized_pnl,
            }
          );
        }
      }
    }

    return closedTrades;
  }

  /**
   * Close a position
   */
  closePosition(symbol, exitPrice, timestamp, exitReason) {
    const position = this.positions.get(symbol);
    if (!position) return null;

    const { quantity, entryPrice, entryTime } = position;
    const totalValue = quantity * exitPrice;
    const entryValue = quantity * entryPrice;
    const realizedPnl = totalValue - entryValue;
    const holdDuration = timestamp.getTime() - entryTime.getTime();

    // Update cash
    this.cash += totalValue;

    // Create trade record
    const trade = {
      id: `trade-${this.trades.length + 1}`,
      ticker: symbol.replace('-USD', ''),
      entry_price: entryPrice,
      exit_price: exitPrice,
      quantity: quantity,
      realized_pnl: realizedPnl,
      hold_duration: holdDuration,
      entry_date: entryTime.toISOString(),
      exit_date: timestamp.toISOString(),
      status: 'closed',
      exit_reason: exitReason,
    };

    // Create sell order
    const sellOrder = {
      id: `order-${this.orders.length + 1}`,
      ticker: symbol.replace('-USD', ''),
      action: 'sell',
      shares: quantity,
      price: exitPrice,
      total_value: totalValue,
      reasoning: `Exit: ${exitReason}`,
      executed_at: timestamp.toISOString(),
      meta: {
        exit_reason: exitReason,
      },
    };

    this.trades.push(trade);
    this.orders.push(sellOrder);
    this.positions.delete(symbol);

    // Update daily P&L
    this.updateDailyPnL(timestamp, realizedPnl);

    return trade;
  }

  /**
   * Update daily P&L tracking
   */
  updateDailyPnL(timestamp, pnl) {
    const day = timestamp.toISOString().split('T')[0];
    if (this.currentDay !== day) {
      this.currentDay = day;
      this.dailyPnL = 0;
    }
    this.dailyPnL += pnl;
  }

  /**
   * Execute a buy order
   */
  executeBuy(symbol, entryPrice, timestamp, reasoning) {
    const riskManager = new RiskManager(this.config);

    // Calculate stop price
    const stopPrice = entryPrice * (1 - this.config.strategy.stopLossPct);
    const riskPerUnit = entryPrice - stopPrice;
    const takeProfitPrice = entryPrice + (riskPerUnit * this.config.strategy.takeProfitRMultiple);

    // Check risk constraints
    const portfolio = {
      equity: this.getEquity(),
      cash_balance: this.cash,
    };

    const riskCheck = riskManager.canOpenPosition({
      portfolio,
      openPositionsCount: this.positions.size,
      todayRealizedPnl: this.dailyPnL,
      lastStopOutAt: this.lastStopOutAt,
      now: timestamp,
    });

    if (!riskCheck.allowed) {
      return { ok: false, reason: riskCheck.reason };
    }

    // Calculate position size
    const positionSizeResult = riskManager.computePositionSize({
      equity: this.getEquity(),
      entryPrice,
      stopPrice,
      cashBalance: this.cash,
    });

    if (!positionSizeResult.ok) {
      return { ok: false, reason: positionSizeResult.reason };
    }

    const { quantity } = positionSizeResult;
    const totalValue = quantity * entryPrice;

    // Check minimum trade value
    if (totalValue < 10) {
      return { ok: false, reason: "MIN_TRADE_VALUE" };
    }

    // Check if we have enough cash
    if (totalValue > this.cash) {
      return { ok: false, reason: "INSUFFICIENT_CASH" };
    }

    // Execute trade
    this.cash -= totalValue;
    this.positions.set(symbol, {
      quantity,
      entryPrice,
      stopPrice,
      takeProfitPrice,
      entryTime: timestamp,
    });

    // Create buy order
    const buyOrder = {
      id: `order-${this.orders.length + 1}`,
      ticker: symbol.replace('-USD', ''),
      action: 'buy',
      shares: quantity,
      price: entryPrice,
      total_value: totalValue,
      reasoning: reasoning,
      executed_at: timestamp.toISOString(),
      meta: {
        stop_loss_price: stopPrice,
        entry_reason: reasoning,
      },
    };

    this.orders.push(buyOrder);

    return {
      ok: true,
      quantity,
      totalValue,
      stopPrice,
      takeProfitPrice,
    };
  }

  /**
   * Get current equity (cash + positions value)
   */
  getEquity(prices = {}) {
    let equity = this.cash;
    for (const [symbol, position] of this.positions.entries()) {
      const currentPrice = prices[symbol] || position.entryPrice;
      equity += position.quantity * currentPrice;
    }
    return equity;
  }

  /**
   * Get open holdings
   */
  getHoldings(prices = {}) {
    const holdings = [];
    for (const [symbol, position] of this.positions.entries()) {
      const currentPrice = prices[symbol] || position.entryPrice;
      const value = position.quantity * currentPrice;
      const cost = position.quantity * position.entryPrice;
      const pnl = value - cost;
      const pnlPercent = (pnl / cost) * 100;

      holdings.push({
        ticker: symbol.replace('-USD', ''),
        quantity: position.quantity,
        average_cost: position.entryPrice,
        value: value,
        pnl: pnl,
        pnl_percent: pnlPercent,
      });
    }
    return holdings;
  }

  /**
   * Get all trades (both closed and open)
   */
  getTrades() {
    // Combine closed trades with open positions
    const openTrades = [];
    for (const [symbol, position] of this.positions.entries()) {
      openTrades.push({
        ticker: symbol.replace('-USD', ''),
        entry_price: position.entryPrice,
        quantity: position.quantity,
        entry_date: position.entryTime.toISOString(),
        exit_price: null,
        exit_date: null,
        status: 'open',
        stop_loss_price: position.stopPrice,
        take_profit_price: position.takeProfitPrice,
      });
    }
    return [...this.trades, ...openTrades];
  }

  /**
   * Get all orders
   */
  getOrders() {
    return this.orders;
  }

  /**
   * Get latest indicators for all symbols
   * Returns a map of symbol -> indicator values + signal status
   */
  getIndicators() {
    return this.latestIndicators || {};
  }

  /**
   * Process a 5m candle: check for signals and execute trades
   * Uses engine logic via server API for evaluation and logging
   * Returns any new trades executed
   */
  async process5mCandle(candle, timestamp) {
    const productId = candle.productId;
    const symbol = productId.replace('-USD', '');
    const timeStr = timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    // Add candle to buffer
    this.addCandle(candle, '5m');

    // Get latest 1h candle (should already be loaded)
    const candles1h = this.candles1h.get(productId) || [];

    // Initialize indicators storage
    if (!this.latestIndicators) this.latestIndicators = {};

    if (candles1h.length === 0) {
      // Store warmup status
      this.latestIndicators[symbol] = {
        price: candle.close,
        warmingUp: true,
        warmupMessage: 'Waiting for 1h candles...',
        signal: 'WAIT',
        signalReason: 'NO_1H_DATA',
      };
      return []; // Need 1h candles for strategy
    }

    // Find latest closed 1h candle (before or at current timestamp)
    // Use getTime() for reliable numeric comparison
    const timestampMs = timestamp.getTime();
    const latest1hCandle = candles1h
      .filter(c => c.timestamp.getTime() <= timestampMs)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    // Get 5m candles for indicators (need these regardless of 1h status)
    const candles5m = this.candles5m.get(productId) || [];

    if (!latest1hCandle) {
      // No 1h candle, but try to show 5m indicators anyway
      if (candles5m.length >= 20) {
        const latest5mCandle = candles5m[candles5m.length - 1];
        const closes5m = candles5m.map(c => c.close);

        // Compute 5m EMA and RSI manually
        let ema20 = null;
        let rsi14 = null;

        // Simple EMA20 calculation
        if (closes5m.length >= 20) {
          let sum = 0;
          for (let i = 0; i < 20; i++) sum += closes5m[i];
          ema20 = sum / 20;
          const multiplier = 2 / 21;
          for (let i = 20; i < closes5m.length; i++) {
            ema20 = (closes5m[i] - ema20) * multiplier + ema20;
          }
        }

        // Simple RSI14 calculation
        if (closes5m.length >= 15) {
          const deltas = [];
          for (let i = 1; i < closes5m.length; i++) deltas.push(closes5m[i] - closes5m[i - 1]);
          const gains = deltas.map(d => d > 0 ? d : 0);
          const losses = deltas.map(d => d < 0 ? Math.abs(d) : 0);
          let avgGain = 0, avgLoss = 0;
          for (let i = 0; i < 14; i++) { avgGain += gains[i]; avgLoss += losses[i]; }
          avgGain /= 14; avgLoss /= 14;
          for (let i = 14; i < gains.length; i++) {
            avgGain = (avgGain * 13 + gains[i]) / 14;
            avgLoss = (avgLoss * 13 + losses[i]) / 14;
          }
          rsi14 = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        }

        const close5m = latest5mCandle.close;
        const open5m = latest5mCandle.open;
        const pullbackPct = ema20 ? Math.abs(close5m - ema20) / ema20 * 100 : null;

        this.latestIndicators[symbol] = {
          price: close5m,
          warmingUp: false,
          no1hData: true,
          // Show available 5m indicators
          ema20_5m: ema20,
          rsi: rsi14,
          pullbackPct: pullbackPct,
          pullbackThreshold: this.config.strategy.pullbackPct * 100,
          rsiMin: this.config.strategy.rsiMin,
          rsiMax: this.config.strategy.rsiMax,
          isGreenCandle: close5m > open5m,
          // 1h indicators unavailable
          regimePassing: null,
          emaSlope: null,
          signal: 'HOLD',
          signalReason: 'NO_1H_DATA',
        };
      } else {
        const firstCandle = candles1h[0];
        this.latestIndicators[symbol] = {
          price: candle.close,
          warmingUp: true,
          warmupMessage: `1h candles: ${candles1h.length} (first: ${firstCandle?.timestamp?.toISOString()?.slice(0, 16)})`,
          signal: 'WAIT',
          signalReason: 'NO_1H_CANDLE',
        };
      }
      return []; // Can't trade without 1h regime filter
    }

    if (candles5m.length < 20) {
      this.latestIndicators[symbol] = {
        price: candle.close,
        warmingUp: true,
        warmupMessage: `Warming up: ${candles5m.length}/20 candles`,
        signal: 'WAIT',
        signalReason: 'INSUFFICIENT_5M_DATA',
      };
      return []; // Need enough candles for indicators
    }

    // Get latest 5m candle
    const latest5mCandle = candles5m[candles5m.length - 1];

    // Filter 1h candles to only include those up to current simulation time
    // This is critical for proper backtesting - we shouldn't use future data!
    const candles1hFiltered = candles1h.filter(c => c.timestamp.getTime() <= timestampMs);

    // Compute indicators using only data available at this point in time
    const indicatorResult = computeIndicators({
      candles5m,
      candles1h: candles1hFiltered,
      config: this.config,
    });

    if (!indicatorResult.ok) {
      this.latestIndicators[symbol] = {
        price: latest5mCandle.close,
        warmingUp: true,
        warmupMessage: `Indicators: ${indicatorResult.reason}`,
        signal: 'WAIT',
        signalReason: indicatorResult.reason,
      };
      return []; // Indicators not ready
    }

    // Evaluate entry signal
    const signalResult = evaluateEntrySignal({
      latest5mCandle,
      latest1hCandle,
      indicators: indicatorResult,
      config: this.config,
    });

    const { ema20_5m, rsi14_5m, ema200_1h, ema200Slope } = indicatorResult.values;
    const price = latest5mCandle.close.toFixed(2);
    const close1h = latest1hCandle.close;
    const close5m = latest5mCandle.close;
    const open5m = latest5mCandle.open;
    const pullbackPctActual = Math.abs(close5m - ema20_5m) / ema20_5m;

    // Store indicators for UI display
    if (!this.latestIndicators) this.latestIndicators = {};
    this.latestIndicators[symbol] = {
      price: close5m,
      // 1h indicators
      close1h,
      ema50_1h: ema200_1h,
      emaSlope: ema200Slope,
      regimePassing: close1h > ema200_1h && ema200Slope > 0,
      // 5m indicators
      ema20_5m,
      rsi: rsi14_5m,
      pullbackPct: pullbackPctActual * 100,
      isGreenCandle: close5m > open5m,
      // Thresholds from config
      pullbackThreshold: this.config.strategy.pullbackPct * 100,
      rsiMin: this.config.strategy.rsiMin,
      rsiMax: this.config.strategy.rsiMax,
      // Overall signal
      signal: signalResult.action,
      signalReason: signalResult.reason,
    };

    // Debug logging - sample every 100 ticks to see what's blocking trades
    if (!this.debugCounter) this.debugCounter = 0;
    this.debugCounter++;

    if (this.debugCounter % 100 === 1) {
      console.log(
        `📊 [DEBUG ${symbol}] @ $${price}`,
        `\n   1h: close=${close1h.toFixed(2)} vs EMA50=${ema200_1h.toFixed(2)} (${close1h > ema200_1h ? '✅ ABOVE' : '❌ BELOW'})`,
        `\n   1h: EMA slope=${ema200Slope.toFixed(2)} (${ema200Slope > 0 ? '✅ POSITIVE' : '❌ NEGATIVE'})`,
        `\n   5m: pullback=${(pullbackPctActual * 100).toFixed(2)}% (need < ${this.config.strategy.pullbackPct * 100}%)`,
        `\n   5m: RSI=${rsi14_5m.toFixed(1)} (need ${this.config.strategy.rsiMin}-${this.config.strategy.rsiMax})`,
        `\n   5m: candle=${close5m > open5m ? '✅ GREEN' : '❌ RED'}`,
        `\n   → ${signalResult.action}: ${signalResult.reason}`
      );
    }



    // Log BUY decision to server console
    // Log BUY decision to server console
    if (signalResult.action === 'BUY') {
      logDecisionToServer(
        symbol,
        timestamp.toISOString(),
        signalResult.action,
        signalResult.reason,
        {
          price: latest5mCandle.close,
          rsi: rsi14_5m.toFixed(1),
          ema20: ema20_5m.toFixed(2),
          ema200: ema200_1h.toFixed(2),
          slope: ema200Slope.toFixed(2),
        }
      );
    }
    // HOLD decisions are not logged

    const newTrades = [];

    // Check for entry signal
    if (signalResult.action === 'BUY' && !this.positions.has(productId)) {
      const entryResult = this.executeBuy(
        productId,
        latest5mCandle.close,
        timestamp,
        signalResult.reason
      );

      if (entryResult.ok) {
        console.log(
          `%c🚀 TRADE EXECUTED | ${symbol} | Qty: ${entryResult.quantity.toFixed(4)} | Stop: $${entryResult.stopPrice.toFixed(2)} | TP: $${entryResult.takeProfitPrice.toFixed(2)}`,
          'color: #10b981; font-weight: bold; background: #10b98120; padding: 2px 6px; border-radius: 4px'
        );
        newTrades.push({
          type: 'buy',
          productId,
          price: latest5mCandle.close,
          quantity: entryResult.quantity,
          timestamp,
        });
      } else {
        // Only log blcoked trades if it's NOT just a position limit
        if (entryResult.reason !== 'MAX_POSITIONS') {
          console.log(
            `%c⚠️ BUY BLOCKED | ${symbol} | Reason: ${entryResult.reason}`,
            'color: #f59e0b'
          );
        }
      }
    }

    return newTrades;
  }
}

export { BacktestTradingEngine };
