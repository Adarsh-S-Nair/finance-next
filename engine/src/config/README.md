# Engine Configuration

This directory contains the engine configuration and risk management settings.

## Files

- `engineConfig.js` - Default engine settings, risk constraints, and configuration utilities

## Configuration Structure

### Timeframes

- **signalTimeframe** (`"5m"`): The timeframe used for generating trading signals and entry/exit decisions.
- **regimeTimeframe** (`"1h"`): The timeframe used for determining overall market regime and trend direction.
- **executionTimeframe** (`"1m"`): The timeframe used for order execution and position management.

### Risk Parameters

- **riskPerTradePct** (`0.005`): Maximum percentage of portfolio capital to risk on a single trade (0.5% default).
- **maxOpenPositions** (`1`): Maximum number of concurrent open positions allowed.
- **maxDailyNetOutflowPct** (`1.0`): Maximum percentage of portfolio capital that can be deployed as net cash outflow in a single day before trading stops (100% default, allows one full deployment per day). This is a conservative proxy for daily loss limiting.
- **cooldownBarsAfterStop** (`6`): Number of bars to wait after a stop-loss is hit before allowing new trades.
- **requireStopLoss** (`true`): Whether all trades must have a stop-loss order before execution.
- **feeBps** (`5`): Trading fees in basis points (0.05% default).
- **slippageBps** (`5`): Expected slippage in basis points when executing trades (0.05% default).

### Strategy Parameters

- **emaFast** (`20`): Period for the fast exponential moving average used in trend detection.
- **emaSlow** (`200`): Period for the slow exponential moving average used in trend detection.
- **rsiPeriod** (`14`): Period for the Relative Strength Index indicator calculation.
- **pullbackPct** (`0.003`): Percentage pullback from recent highs required for entry signals (0.3% default).
- **rsiMin** (`40`): Minimum RSI value required for entry signals.
- **rsiMax** (`55`): Maximum RSI value allowed for entry signals.
- **stopLossPct** (`0.005`): Stop-loss distance as percentage of entry price (0.5% default).
- **takeProfitRMultiple** (`2`): Take-profit target as a multiple of the risk amount (R-multiple).

## Usage

```javascript
const { getDefaultEngineConfig, mergePortfolioConfig } = require('./engineConfig');

// Get default configuration
const defaultConfig = getDefaultEngineConfig();

// Merge portfolio-specific overrides
const portfolioConfig = mergePortfolioConfig(defaultConfig, {
  risk: {
    riskPerTradePct: 0.01,  // 1% risk per trade
    maxOpenPositions: 2,
  },
  strategy: {
    emaFast: 10,
  },
});
```

## Validation

The `mergePortfolioConfig` function automatically validates all configuration values:

- Percentages must be between 0 and 1 (0% to 100%)
- Integer values (like periods and counts) must be positive integers
- Boolean values are enforced for flags
- Invalid values are automatically replaced with defaults

This ensures that portfolio-specific overrides cannot create unsafe or invalid configurations.

