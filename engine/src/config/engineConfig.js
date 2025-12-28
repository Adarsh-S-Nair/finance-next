const DEFAULT_RISK = {
  riskPerTradePct: 0.005,
  maxOpenPositions: 1,
  dailyLossLimitPct: 0.02,
  cooldownBarsAfterStop: 6,
  requireStopLoss: true,
  stopLossPct: 0.0075,
  trailActivationPct: 0.005,
  trailGapPct: 0.003,
};

const DEFAULT_EXECUTION = {
  feeBps: 2,
  slippageBps: 1,
};

const DEFAULT_ENGINE = {
  loopIntervalMs: 30000,
  signalTimeframe: '5m',
  trendTimeframe: '1h',
  slopeLookback: 3,
  min1hFallbackBars: 200,
};

function loadEnv(name, fallback) {
  const value = process.env[name];
  if (!value && fallback === undefined) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value || fallback;
}

function loadEngineConfig() {
  const supabaseUrl = loadEnv('SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
  const supabaseKey = loadEnv('SUPABASE_SERVICE_ROLE_KEY');

  return {
    supabase: {
      url: supabaseUrl,
      serviceKey: supabaseKey,
    },
    engine: DEFAULT_ENGINE,
    risk: DEFAULT_RISK,
    execution: DEFAULT_EXECUTION,
    portfolios: [],
  };
}

module.exports = {
  loadEngineConfig,
};
