/**
 * Engine configuration and risk constraints
 * Provides default settings and utilities for merging portfolio-specific overrides
 */

/**
 * Default engine configuration
 */
const ENGINE_CONFIG = {
  timeframes: {
    signalTimeframe: "5m",
    regimeTimeframe: "1h",
    executionTimeframe: "1m",
  },
  risk: {
    riskPerTradePct: 0.005,        // 0.5% risk per trade
    maxOpenPositions: 1,
    maxDailyNetOutflowPct: 1.0,    // 100% max daily net cash outflow limit (allows one full deployment per day)
    cooldownBarsAfterStop: 6,
    requireStopLoss: true,
    feeBps: 5,                      // 5 basis points (0.05%)
    slippageBps: 5,                 // 5 basis points (0.05%)
  },
  strategy: {
    emaFast: 20,
    emaSlow: 200,
    rsiPeriod: 14,
    pullbackPct: 0.003,             // 0.3%
    rsiMin: 40,
    rsiMax: 55,
    stopLossPct: 0.005,             // 0.5%
    takeProfitRMultiple: 2,
  },
};

/**
 * Get default engine configuration
 * @returns {Object} Default engine configuration object
 */
function getDefaultEngineConfig() {
  return JSON.parse(JSON.stringify(ENGINE_CONFIG));
}

/**
 * Deep merge utility that safely combines objects
 * @param {Object} target - Target object to merge into
 * @param {Object} source - Source object to merge from
 * @returns {Object} Merged object
 */
function deepMerge(target, source) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

/**
 * Check if value is a plain object
 * @param {*} item - Value to check
 * @returns {boolean} True if item is a plain object
 */
function isObject(item) {
  return item && typeof item === "object" && !Array.isArray(item);
}

/**
 * Validate and sanitize configuration values
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validated configuration with invalid values replaced by defaults
 */
function validateConfig(config) {
  const defaults = getDefaultEngineConfig();
  const validated = { ...config };

  // Validate timeframes (must be strings)
  if (validated.timeframes) {
    if (typeof validated.timeframes.signalTimeframe !== "string") {
      validated.timeframes.signalTimeframe = defaults.timeframes.signalTimeframe;
    }
    if (typeof validated.timeframes.regimeTimeframe !== "string") {
      validated.timeframes.regimeTimeframe = defaults.timeframes.regimeTimeframe;
    }
    if (typeof validated.timeframes.executionTimeframe !== "string") {
      validated.timeframes.executionTimeframe = defaults.timeframes.executionTimeframe;
    }
  }

  // Validate risk parameters
  if (validated.risk) {
    // riskPerTradePct must be positive and <= 1 (100%)
    if (
      typeof validated.risk.riskPerTradePct !== "number" ||
      validated.risk.riskPerTradePct <= 0 ||
      validated.risk.riskPerTradePct > 1
    ) {
      validated.risk.riskPerTradePct = defaults.risk.riskPerTradePct;
    }

    // maxOpenPositions must be >= 1
    if (
      typeof validated.risk.maxOpenPositions !== "number" ||
      validated.risk.maxOpenPositions < 1 ||
      !Number.isInteger(validated.risk.maxOpenPositions)
    ) {
      validated.risk.maxOpenPositions = defaults.risk.maxOpenPositions;
    }

    // maxDailyNetOutflowPct must be positive and <= 1 (100%)
    if (
      typeof validated.risk.maxDailyNetOutflowPct !== "number" ||
      validated.risk.maxDailyNetOutflowPct <= 0 ||
      validated.risk.maxDailyNetOutflowPct > 1
    ) {
      validated.risk.maxDailyNetOutflowPct = defaults.risk.maxDailyNetOutflowPct;
    }

    // cooldownBarsAfterStop must be >= 0
    if (
      typeof validated.risk.cooldownBarsAfterStop !== "number" ||
      validated.risk.cooldownBarsAfterStop < 0 ||
      !Number.isInteger(validated.risk.cooldownBarsAfterStop)
    ) {
      validated.risk.cooldownBarsAfterStop = defaults.risk.cooldownBarsAfterStop;
    }

    // requireStopLoss must be boolean
    if (typeof validated.risk.requireStopLoss !== "boolean") {
      validated.risk.requireStopLoss = defaults.risk.requireStopLoss;
    }

    // feeBps must be >= 0
    if (
      typeof validated.risk.feeBps !== "number" ||
      validated.risk.feeBps < 0
    ) {
      validated.risk.feeBps = defaults.risk.feeBps;
    }

    // slippageBps must be >= 0
    if (
      typeof validated.risk.slippageBps !== "number" ||
      validated.risk.slippageBps < 0
    ) {
      validated.risk.slippageBps = defaults.risk.slippageBps;
    }
  }

  // Validate strategy parameters
  if (validated.strategy) {
    // emaFast must be positive integer
    if (
      typeof validated.strategy.emaFast !== "number" ||
      validated.strategy.emaFast <= 0 ||
      !Number.isInteger(validated.strategy.emaFast)
    ) {
      validated.strategy.emaFast = defaults.strategy.emaFast;
    }

    // emaSlow must be positive integer
    if (
      typeof validated.strategy.emaSlow !== "number" ||
      validated.strategy.emaSlow <= 0 ||
      !Number.isInteger(validated.strategy.emaSlow)
    ) {
      validated.strategy.emaSlow = defaults.strategy.emaSlow;
    }

    // rsiPeriod must be positive integer
    if (
      typeof validated.strategy.rsiPeriod !== "number" ||
      validated.strategy.rsiPeriod <= 0 ||
      !Number.isInteger(validated.strategy.rsiPeriod)
    ) {
      validated.strategy.rsiPeriod = defaults.strategy.rsiPeriod;
    }

    // pullbackPct must be positive and <= 1 (100%)
    if (
      typeof validated.strategy.pullbackPct !== "number" ||
      validated.strategy.pullbackPct <= 0 ||
      validated.strategy.pullbackPct > 1
    ) {
      validated.strategy.pullbackPct = defaults.strategy.pullbackPct;
    }

    // rsiMin must be between 0 and 100
    if (
      typeof validated.strategy.rsiMin !== "number" ||
      validated.strategy.rsiMin < 0 ||
      validated.strategy.rsiMin > 100
    ) {
      validated.strategy.rsiMin = defaults.strategy.rsiMin;
    }

    // rsiMax must be between 0 and 100
    if (
      typeof validated.strategy.rsiMax !== "number" ||
      validated.strategy.rsiMax < 0 ||
      validated.strategy.rsiMax > 100
    ) {
      validated.strategy.rsiMax = defaults.strategy.rsiMax;
    }

    // stopLossPct must be positive and <= 1 (100%)
    if (
      typeof validated.strategy.stopLossPct !== "number" ||
      validated.strategy.stopLossPct <= 0 ||
      validated.strategy.stopLossPct > 1
    ) {
      validated.strategy.stopLossPct = defaults.strategy.stopLossPct;
    }

    // takeProfitRMultiple must be positive
    if (
      typeof validated.strategy.takeProfitRMultiple !== "number" ||
      validated.strategy.takeProfitRMultiple <= 0
    ) {
      validated.strategy.takeProfitRMultiple = defaults.strategy.takeProfitRMultiple;
    }
  }

  return validated;
}

/**
 * Merge portfolio-specific overrides with default configuration
 * Validates all values and falls back to defaults for invalid entries
 * @param {Object} defaultConfig - Default configuration object
 * @param {Object} portfolioOverrides - Portfolio-specific overrides to merge
 * @returns {Object} Merged and validated configuration
 */
function mergePortfolioConfig(defaultConfig, portfolioOverrides) {
  if (!portfolioOverrides || typeof portfolioOverrides !== "object") {
    return getDefaultEngineConfig();
  }

  // Deep merge the overrides with defaults
  const merged = deepMerge(defaultConfig, portfolioOverrides);

  // Validate and sanitize the merged configuration
  return validateConfig(merged);
}

module.exports = {
  ENGINE_CONFIG,
  getDefaultEngineConfig,
  mergePortfolioConfig,
};

