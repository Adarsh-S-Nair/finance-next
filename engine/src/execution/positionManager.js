class PositionManager {
  constructor(config, executionService, riskManager, logger) {
    this.config = config;
    this.executionService = executionService;
    this.riskManager = riskManager;
    this.logger = logger;
  }

  evaluateOpenPositions({ portfolio, symbol, latestCandle, now }) {
    if (!latestCandle || !symbol) return { action: 'HOLD', reason: 'MISSING_CANDLE' };
    const openPosition = this.executionService.getOpenPosition(portfolio.id, symbol);
    if (!openPosition) return { action: 'HOLD', reason: 'NO_POSITION' };

    this.#updateTrailing(openPosition, latestCandle);

    const stopHit = latestCandle.low <= openPosition.stopPrice;
    const tpHit = latestCandle.high >= (openPosition.takeProfitPrice || 0);
    const trailHit = openPosition.trailStop && latestCandle.low <= openPosition.trailStop;

    if (stopHit) {
      const result = this.executionService.closePosition({
        portfolioId: portfolio.id,
        positionId: openPosition.id,
        exitPrice: openPosition.stopPrice,
        reason: 'STOP',
        now,
      });
      if (result.ok) {
        this.riskManager?.recordStopOut(portfolio.id, openPosition.symbol, now);
      }
      return { action: 'EXIT', reason: 'STOP', result };
    }

    if (tpHit) {
      const result = this.executionService.closePosition({
        portfolioId: portfolio.id,
        positionId: openPosition.id,
        exitPrice: openPosition.takeProfitPrice,
        reason: 'TP',
        now,
      });
      return { action: 'EXIT', reason: 'TP', result };
    }

    if (trailHit) {
      const result = this.executionService.closePosition({
        portfolioId: portfolio.id,
        positionId: openPosition.id,
        exitPrice: openPosition.trailStop,
        reason: 'TRAIL',
        now,
      });
      return { action: 'EXIT', reason: 'TRAIL', result };
    }

    return { action: 'HOLD', reason: 'NO_EXIT', trailStop: openPosition.trailStop };
  }

  #updateTrailing(position, candle) {
    if (candle.close > position.highestClose) {
      position.highestClose = candle.close;
    }

    const activationPrice = position.entryPrice * (1 + this.config.risk.trailActivationPct);
    if (!position.trailActive && candle.close >= activationPrice) {
      position.trailActive = true;
      position.trailStop = candle.close * (1 - this.config.risk.trailGapPct);
      return;
    }

    if (position.trailActive) {
      const candidate = position.highestClose * (1 - this.config.risk.trailGapPct);
      if (!position.trailStop || candidate > position.trailStop) {
        position.trailStop = candidate;
      }
    }
  }
}

module.exports = {
  PositionManager,
};
