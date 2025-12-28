const { startOfUtcDay, timeframeToMs } = require('../utils/time');

class RiskManager {
  constructor(baseConfig, logger) {
    this.config = baseConfig;
    this.logger = logger;
    this.cooldowns = new Map(); // portfolioId -> Map(symbol -> timestamp)
    this.dailyLosses = new Map(); // portfolioId -> { day: string, loss: number }
  }

  canOpenPosition(portfolioState, symbol, now, signalTimeframe) {
    const risk = { ...this.config, ...(portfolioState?.riskOverrides || {}) };

    if ((portfolioState.openPositions || []).length >= risk.maxOpenPositions) {
      return { allowed: false, reason: 'MAX_POSITIONS' };
    }

    if (this.#isInCooldown(portfolioState.id, symbol, now, signalTimeframe, risk)) {
      return { allowed: false, reason: 'COOLDOWN' };
    }

    if (this.#exceedsDailyLoss(portfolioState, risk, now)) {
      return { allowed: false, reason: 'DAILY_LOSS_LIMIT' };
    }

    return { allowed: true, risk }; // include risk snapshot for downstream use
  }

  computePositionSize({ equity, entryPrice, stopPrice, riskPerTradePct }) {
    const riskPct = riskPerTradePct ?? this.config.riskPerTradePct;
    if (!equity || !entryPrice || !stopPrice || entryPrice <= stopPrice) {
      return 0;
    }
    const riskAmount = equity * riskPct;
    const perUnitRisk = entryPrice - stopPrice;
    if (perUnitRisk <= 0) {
      return 0;
    }
    const size = riskAmount / perUnitRisk;
    return Number.isFinite(size) && size > 0 ? size : 0;
  }

  recordStopOut(portfolioId, symbol, time) {
    if (!this.cooldowns.has(portfolioId)) {
      this.cooldowns.set(portfolioId, new Map());
    }
    this.cooldowns.get(portfolioId).set(symbol, time);
  }

  trackRealizedPnl(portfolioId, pnl, now) {
    const dayKey = startOfUtcDay(now).toISOString();
    const existing = this.dailyLosses.get(portfolioId);
    if (!existing || existing.day !== dayKey) {
      this.dailyLosses.set(portfolioId, { day: dayKey, loss: 0 });
    }
    const current = this.dailyLosses.get(portfolioId);
    current.loss += pnl;
  }

  #exceedsDailyLoss(portfolioState, risk, now) {
    if (!portfolioState || !portfolioState.equity || portfolioState.equity <= 0) {
      return true;
    }
    const dayKey = startOfUtcDay(now).toISOString();
    const record = this.dailyLosses.get(portfolioState.id);
    const loss = record && record.day === dayKey ? record.loss : 0;
    const threshold = -Math.abs(portfolioState.equity * risk.dailyLossLimitPct);
    return loss <= threshold;
  }

  #isInCooldown(portfolioId, symbol, now, signalTimeframe, risk) {
    if (!symbol) {
      return false;
    }
    const map = this.cooldowns.get(portfolioId);
    if (!map || !map.has(symbol)) {
      return false;
    }
    const since = map.get(symbol);
    const length = timeframeToMs(signalTimeframe || '5m') || 0;
    const cooldownMs = length * (risk.cooldownBarsAfterStop ?? this.config.cooldownBarsAfterStop);
    return now.getTime() - since.getTime() < cooldownMs;
  }
}

module.exports = {
  RiskManager,
};
