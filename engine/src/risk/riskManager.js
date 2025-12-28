/**
 * Risk Manager
 * Enforces risk rules before any signals are evaluated
 */

const { timeframeToMs } = require("../utils/time");

/**
 * RiskManager class for enforcing trading risk constraints
 */
class RiskManager {
  /**
   * @param {Object} config - Engine configuration object (from engineConfig.js)
   */
  constructor(config) {
    if (!config || !config.risk) {
      throw new Error("RiskManager requires a config object with risk settings");
    }
    this.config = config;
  }

  /**
   * Check if a new position can be opened
   * @param {Object} params - Parameters for the check
   * @param {Object} params.portfolio - Portfolio object with id, equity, cash_balance
   * @param {number} params.openPositionsCount - Current number of open positions
   * @param {number} params.todayRealizedPnl - Realized PnL for today in dollars (negative if down)
   * @param {Date|null} params.lastStopOutAt - Timestamp of last stop-out, or null
   * @param {Date} params.now - Current timestamp
   * @returns {Object} { allowed: true } or { allowed: false, reason: string, details?: Object }
   */
  canOpenPosition({ portfolio, openPositionsCount, todayRealizedPnl, lastStopOutAt, now }) {
    // INSUFFICIENT_EQUITY: block if portfolio.equity <= 0
    if (!portfolio || typeof portfolio.equity !== "number" || portfolio.equity <= 0) {
      return {
        allowed: false,
        reason: "INSUFFICIENT_EQUITY",
        details: {
          equity: portfolio?.equity,
        },
      };
    }

    // MAX_POSITIONS: block if openPositionsCount >= config.risk.maxOpenPositions
    // Default to 0 if not provided or invalid
    const currentOpenPositions = typeof openPositionsCount === "number" ? openPositionsCount : 0;
    if (currentOpenPositions >= this.config.risk.maxOpenPositions) {
      return {
        allowed: false,
        reason: "MAX_POSITIONS",
        details: {
          openPositionsCount: currentOpenPositions,
          maxOpenPositions: this.config.risk.maxOpenPositions,
        },
      };
    }

    // DAILY_OUTFLOW_LIMIT: block if todayNetOutflowProxy <= -(portfolio.equity * config.risk.maxDailyNetOutflowPct)
    // Note: todayRealizedPnl parameter is actually a "todayNetOutflowProxy" (negative net cash outflow)
    const maxOutflowDollars = portfolio.equity * this.config.risk.maxDailyNetOutflowPct;
    if (typeof todayRealizedPnl === "number" && todayRealizedPnl <= -maxOutflowDollars) {
      return {
        allowed: false,
        reason: "DAILY_OUTFLOW_LIMIT",
        details: {
          todayNetOutflowProxy: todayRealizedPnl,
          maxOutflowDollars,
          maxDailyNetOutflowPct: this.config.risk.maxDailyNetOutflowPct,
        },
      };
    }

    // COOLDOWN: if lastStopOutAt exists, enforce cooldownBarsAfterStop bars on the SIGNAL timeframe
    if (lastStopOutAt) {
      const isCooldown = this.isCooldownActive({
        lastStopOutAt,
        now,
        candleDurationMs: timeframeToMs(this.config.timeframes.signalTimeframe),
      });

      if (isCooldown) {
        const cooldownWindowMs =
          this.config.risk.cooldownBarsAfterStop *
          timeframeToMs(this.config.timeframes.signalTimeframe);
        const timeSinceStopOut = now.getTime() - lastStopOutAt.getTime();

        return {
          allowed: false,
          reason: "COOLDOWN",
          details: {
            lastStopOutAt,
            now,
            cooldownBarsAfterStop: this.config.risk.cooldownBarsAfterStop,
            signalTimeframe: this.config.timeframes.signalTimeframe,
            cooldownWindowMs,
            timeSinceStopOutMs: timeSinceStopOut,
            remainingMs: cooldownWindowMs - timeSinceStopOut,
          },
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Compute position size based on risk parameters
   * @param {Object} params - Parameters for position sizing
   * @param {number} params.equity - Portfolio equity
   * @param {number} params.entryPrice - Entry price for the trade
   * @param {number} params.stopPrice - Stop-loss price
   * @param {number} params.cashBalance - Available cash balance (optional, defaults to equity)
   * @returns {Object} { ok: true, quantity, riskDollars, perUnitRisk } or { ok: false, reason: string }
   */
  computePositionSize({ equity, entryPrice, stopPrice, cashBalance }) {
    // Validate inputs
    if (typeof equity !== "number" || equity <= 0) {
      return { ok: false, reason: "INVALID_EQUITY" };
    }

    if (typeof entryPrice !== "number" || entryPrice <= 0) {
      return { ok: false, reason: "INVALID_ENTRY_PRICE" };
    }

    if (typeof stopPrice !== "number" || stopPrice <= 0) {
      return { ok: false, reason: "INVALID_STOP_PRICE" };
    }

    // Use cashBalance if provided, otherwise default to equity
    const availableCash = typeof cashBalance === "number" && cashBalance >= 0 ? cashBalance : equity;

    // Calculate risk per unit
    const perUnitRisk = Math.abs(entryPrice - stopPrice);
    if (perUnitRisk <= 0) {
      return { ok: false, reason: "INVALID_STOP", details: { entryPrice, stopPrice, perUnitRisk } };
    }

    // Calculate risk dollars based on equity
    const riskDollars = equity * this.config.risk.riskPerTradePct;

    // Calculate quantity based on risk
    let quantity = riskDollars / perUnitRisk;

    // Guard against NaN or Infinity
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        ok: false,
        reason: "INVALID_QUANTITY",
        details: { riskDollars, perUnitRisk, quantity },
      };
    }

    // Cap quantity by what we can afford with cash
    const maxAffordableQty = availableCash / entryPrice;
    const finalQty = Math.min(quantity, maxAffordableQty);

    // Ensure final quantity is valid
    if (!Number.isFinite(finalQty) || finalQty <= 0) {
      return {
        ok: false,
        reason: "INVALID_FINAL_QUANTITY",
        details: { quantity, maxAffordableQty, finalQty, availableCash, entryPrice },
      };
    }

    return {
      ok: true,
      quantity: finalQty,
      riskDollars,
      perUnitRisk,
      maxAffordableQty,
    };
  }

  /**
   * Check if daily outflow limit has been hit
   * @param {Object} params - Parameters for the check
   * @param {Object} params.portfolio - Portfolio object with equity
   * @param {number} params.todayRealizedPnl - Today's net outflow proxy (negative net cash outflow) in dollars
   * @returns {boolean} True if daily outflow limit has been hit
   */
  isDailyLossLimitHit({ portfolio, todayRealizedPnl }) {
    if (!portfolio || typeof portfolio.equity !== "number" || portfolio.equity <= 0) {
      return true; // Consider limit hit if we can't determine equity
    }

    if (typeof todayRealizedPnl !== "number") {
      return false; // Can't determine if limit hit without outflow data
    }

    const maxOutflowDollars = portfolio.equity * this.config.risk.maxDailyNetOutflowPct;
    return todayRealizedPnl <= -maxOutflowDollars;
  }

  /**
   * Check if cooldown period is still active after a stop-out
   * @param {Object} params - Parameters for the check
   * @param {Date|null} params.lastStopOutAt - Timestamp of last stop-out
   * @param {Date} params.now - Current timestamp
   * @param {number} params.candleDurationMs - Duration of one candle in milliseconds
   * @returns {boolean} True if cooldown is still active
   */
  isCooldownActive({ lastStopOutAt, now, candleDurationMs }) {
    if (!lastStopOutAt) {
      return false; // No stop-out, no cooldown
    }

    if (!(lastStopOutAt instanceof Date) || !(now instanceof Date)) {
      return false; // Invalid dates, assume no cooldown
    }

    if (typeof candleDurationMs !== "number" || candleDurationMs <= 0) {
      return false; // Invalid candle duration, assume no cooldown
    }

    const cooldownWindowMs = this.config.risk.cooldownBarsAfterStop * candleDurationMs;
    const timeSinceStopOut = now.getTime() - lastStopOutAt.getTime();

    return timeSinceStopOut < cooldownWindowMs;
  }
}

module.exports = { RiskManager };

// Example usage:
/*
const { getDefaultEngineConfig } = require("../config/engineConfig");
const { RiskManager } = require("./riskManager");

// Initialize with default config
const config = getDefaultEngineConfig();
const riskManager = new RiskManager(config);

// Example: Check if position can be opened
const portfolio = {
  id: "portfolio-123",
  equity: 10000,
  cash_balance: 5000,
};

const result = riskManager.canOpenPosition({
  portfolio,
  openPositionsCount: 0,
  todayRealizedPnl: -50,
  lastStopOutAt: null,
  now: new Date(),
});

console.log("Can open position:", result);

// Example: Compute position size
const positionSize = riskManager.computePositionSize({
  equity: 10000,
  entryPrice: 50000,
  stopPrice: 49500,
  cashBalance: 5000,
});

console.log("Position size:", positionSize);
*/

