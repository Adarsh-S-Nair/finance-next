/**
 * Engine Tick Orchestrator
 * Runs one evaluation tick per symbol and returns a structured decision
 * Read-only: no DB writes, no trade execution
 */

const { MarketDataRepository } = require("../data/marketDataRepo");
const { PortfolioStateRepository } = require("../data/portfolioStateRepo");
const { computeIndicators } = require("../indicators/indicators");
const { RiskManager } = require("../risk/riskManager");
const { evaluateEntrySignal } = require("../strategy/signalEvaluator");
const { getDefaultEngineConfig, mergePortfolioConfig } = require("../config/engineConfig");

/**
 * Run one engine evaluation tick for a symbol
 * @param {Object} params - Parameters
 * @param {Object} params.supabaseClient - Supabase client instance
 * @param {string} params.symbol - Symbol to evaluate (e.g., "BTC-USD")
 * @param {Date} params.now - Current timestamp
 * @param {string} params.portfolioId - Portfolio ID
 * @param {Object} params.portfolioOverrides - Optional portfolio-specific config overrides
 * @returns {Promise<Object>} Structured decision object
 */
async function runEngineTick({ supabaseClient, symbol, now, portfolioId, portfolioOverrides }) {
  const notes = [];
  const result = {
    ok: false,
    symbol,
    now: now instanceof Date ? now.toISOString() : now,
    risk: { allowed: false },
    marketData: { hasGap5m: false, hasGap1h: false },
    indicators: { ok: false },
    signal: { action: "HOLD", reason: "INIT", debug: {} },
    notes: [],
  };

  try {
    // Validate inputs
    if (!supabaseClient) {
      result.notes.push("Missing supabaseClient");
      return result;
    }

    if (!symbol || typeof symbol !== "string") {
      result.notes.push("Invalid or missing symbol");
      return result;
    }

    if (!(now instanceof Date)) {
      result.notes.push("Invalid or missing now timestamp");
      return result;
    }

    if (!portfolioId || typeof portfolioId !== "string") {
      result.notes.push("Invalid or missing portfolioId");
      return result;
    }

    // Initialize repositories
    const stateRepo = new PortfolioStateRepository(supabaseClient);
    const repo = new MarketDataRepository(supabaseClient);

    // Load portfolio from database
    notes.push("Loading portfolio from database...");
    const portfolioResult = await stateRepo.getPortfolioById({ portfolioId });

    if (!portfolioResult.ok) {
      result.notes.push(`Failed to load portfolio: ${portfolioResult.reason}`);
      result.notes.push(...notes);
      return result;
    }

    const portfolio = portfolioResult.portfolio;
    notes.push(`Portfolio loaded: ${portfolio.id} (status: ${portfolio.status})`);

    // Check if portfolio is active
    if (portfolio.status !== "active") {
      result.notes.push(`Portfolio is not active: ${portfolio.status || "null"}`);
      result.signal = {
        action: "HOLD",
        reason: "PORTFOLIO_NOT_ACTIVE",
        debug: {
          portfolioStatus: portfolio.status || "null",
        },
      };
      result.ok = true; // Tick completed successfully, just blocked by status
      result.notes.push(...notes);
      return result;
    }

    // Get config (merge portfolio overrides if provided)
    const defaultConfig = getDefaultEngineConfig();
    const config = portfolioOverrides
      ? mergePortfolioConfig(defaultConfig, portfolioOverrides)
      : defaultConfig;

    // Fetch market data
    notes.push("Fetching market data...");

    // Fetch latest closed 5m candle
    const latest5mResult = await repo.getLatestClosedCandle({
      symbol,
      timeframe: "5m",
      now,
    });

    if (!latest5mResult.ok) {
      result.notes.push(`Failed to fetch latest 5m candle: ${latest5mResult.reason}`);
      result.notes.push(...notes);
      return result;
    }

    const latest5mCandle = latest5mResult.candle;
    notes.push(`Latest 5m candle: ${latest5mCandle.timestamp.toISOString()}`);

    // Fetch latest closed 1h candle
    const latest1hResult = await repo.getLatestClosedCandle({
      symbol,
      timeframe: "1h",
      now,
    });

    if (!latest1hResult.ok) {
      result.notes.push(`Failed to fetch latest 1h candle: ${latest1hResult.reason}`);
      result.notes.push(...notes);
      return result;
    }

    const latest1hCandle = latest1hResult.candle;
    notes.push(`Latest 1h candle: ${latest1hCandle.timestamp.toISOString()}`);

    // Fetch last 100 closed 5m candles
    const candles5mResult = await repo.getLastNClosedCandles({
      symbol,
      timeframe: "5m",
      n: 100,
      now,
    });

    if (!candles5mResult.ok) {
      result.notes.push(`Failed to fetch 5m candles: ${candles5mResult.reason}`);
      result.notes.push(...notes);
      return result;
    }

    notes.push(`Fetched ${candles5mResult.candles.length} closed 5m candles`);

    // Fetch last 260 closed 1h candles
    const candles1hResult = await repo.getLastNClosedCandles({
      symbol,
      timeframe: "1h",
      n: 260,
      now,
    });

    if (!candles1hResult.ok) {
      result.notes.push(`Failed to fetch 1h candles: ${candles1hResult.reason}`);
      result.notes.push(...notes);
      return result;
    }

    notes.push(`Fetched ${candles1hResult.candles.length} closed 1h candles`);

    // Populate marketData
    result.marketData = {
      latest5mTs: latest5mCandle.timestamp.toISOString(),
      latest1hTs: latest1hCandle.timestamp.toISOString(),
      hasGap5m: candles5mResult.hasGap,
      hasGap1h: candles1hResult.hasGap,
    };

    // Compute indicators
    notes.push("Computing indicators...");
    const indicatorResult = computeIndicators({
      candles5m: candles5mResult.candles,
      candles1h: candles1hResult.candles,
      config,
      hasGap5m: candles5mResult.hasGap,
      hasGap1h: candles1hResult.hasGap,
    });

    result.indicators = {
      ok: indicatorResult.ok,
      reason: indicatorResult.ok ? undefined : indicatorResult.reason,
      values: indicatorResult.ok ? indicatorResult.values : undefined,
    };

    if (!indicatorResult.ok) {
      result.notes.push(`Indicators failed: ${indicatorResult.reason}`);
      result.notes.push(...notes);
      return result;
    }

    notes.push("Indicators computed successfully");

    // Load portfolio state from database
    notes.push("Loading portfolio state from database...");

    // Get open holdings
    const holdingsResult = await stateRepo.getOpenHoldings({ portfolioId });
    if (!holdingsResult.ok) {
      result.notes.push(`Failed to load holdings: ${holdingsResult.reason}`);
      result.notes.push(...notes);
      return result;
    }

    const openPositionsCount = holdingsResult.openPositionsCount;
    notes.push(`Open positions: ${openPositionsCount}`);

    // Get today's net cashflow
    const cashflowResult = await stateRepo.getTodayNetCashflow({ portfolioId, now });
    if (!cashflowResult.ok) {
      result.notes.push(`Failed to load cashflow: ${cashflowResult.reason}`);
      result.notes.push(...notes);
      return result;
    }

    // todayCashSpentProxy = -Math.max(0, -netCashflow)
    // This is not true realized PnL, but a conservative proxy for "cash spent today (negative)"
    // If netCashflow is negative (money went out), that's "down cash today" = negative cash spent proxy
    const todayCashSpentProxy = -Math.max(0, -cashflowResult.netCashflow);
    notes.push(
      `Today net cashflow: $${cashflowResult.netCashflow.toFixed(2)} (cash spent proxy: $${todayCashSpentProxy.toFixed(2)})`
    );

    // Get last stop-out timestamp
    const lastStopOutAt = await stateRepo.getLastStopOutAt({ portfolioId });
    if (lastStopOutAt) {
      notes.push(`Last stop-out: ${lastStopOutAt.toISOString()}`);
    } else {
      notes.push("No stop-out found in lookback period");
    }

    // Initialize RiskManager
    const riskManager = new RiskManager(config);

    // Set equity to starting_capital for now
    // (True equity would include holdings market value, but that requires real-time pricing)
    const equity = portfolio.starting_capital;

    // Set portfolio object for RiskManager
    const portfolioForRisk = {
      id: portfolio.id,
      equity,
      cash_balance: portfolio.current_cash,
    };

    notes.push(`Equity: $${equity.toFixed(2)} (cash: $${portfolio.current_cash.toFixed(2)})`);

    notes.push("Checking risk constraints...");
    // Pass todayCashSpentProxy as todayRealizedPnl to risk manager (keeping signature unchanged for now)
    const riskCheck = riskManager.canOpenPosition({
      portfolio: portfolioForRisk,
      openPositionsCount,
      todayRealizedPnl: todayCashSpentProxy,
      lastStopOutAt,
      now,
    });

    result.risk = {
      allowed: riskCheck.allowed,
      reason: riskCheck.allowed ? undefined : riskCheck.reason,
      details: {
        ...riskCheck.details,
        openPositionsCount,
        todayNetCashflow: cashflowResult.netCashflow,
        todayCashSpentProxy,
        todayRealizedPnl: todayCashSpentProxy, // Keep for backward compatibility
        lastStopOutAt: lastStopOutAt ? lastStopOutAt.toISOString() : null,
      },
    };

    if (!riskCheck.allowed) {
      notes.push(`Risk check failed: ${riskCheck.reason}`);
      // Force HOLD signal when risk blocks
      result.signal = {
        action: "HOLD",
        reason: "BLOCKED_BY_RISK",
        debug: {
          riskReason: riskCheck.reason,
          riskDetails: riskCheck.details,
        },
      };
      result.ok = true; // Tick completed successfully, just blocked by risk
      result.notes.push(...notes);
      return result;
    }

    notes.push("Risk check passed");

    // Evaluate entry signal
    notes.push("Evaluating entry signal...");
    const signalResult = evaluateEntrySignal({
      latest5mCandle,
      latest1hCandle,
      indicators: indicatorResult,
      config,
    });

    result.signal = {
      action: signalResult.action,
      reason: signalResult.reason,
      debug: signalResult.debug,
    };

    notes.push(`Signal: ${signalResult.action} - ${signalResult.reason}`);

    // Tick completed successfully
    result.ok = true;
    result.notes = notes;
    return result;
  } catch (error) {
    // Defensive error handling - never throw
    result.notes.push(`Error during tick: ${error.message || String(error)}`);
    result.notes.push(...notes);
    return result;
  }
}

module.exports = {
  runEngineTick,
};

