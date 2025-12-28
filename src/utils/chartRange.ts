/**
 * Portfolio-scoped crypto chart range logic
 * 
 * Handles timeframe selection and query window calculation for crypto candle charts.
 * All ranges are bounded by portfolio creation date - we never show data before
 * the portfolio was created.
 */

export type ChartRange = '1D' | '1W' | '1M' | '3M' | 'ALL';
export type CandleTimeframe = '1m' | '5m' | '1h' | '1d';

export interface ChartQuery {
  timeframe: CandleTimeframe;
  startTime: Date;
  endTime: Date;
  maxPoints?: number;
}

export interface ChartQueryParams {
  productId: string;
  portfolioCreatedAt: Date;
  range: ChartRange;
  now?: Date;
}

/**
 * Calculate the duration in milliseconds for a given range
 */
function getRangeDuration(range: ChartRange): number {
  const now = Date.now();
  switch (range) {
    case '1D':
      return 24 * 60 * 60 * 1000; // 1 day
    case '1W':
      return 7 * 24 * 60 * 60 * 1000; // 7 days
    case '1M':
      return 30 * 24 * 60 * 60 * 1000; // ~30 days
    case '3M':
      return 90 * 24 * 60 * 60 * 1000; // ~90 days
    case 'ALL':
      return Infinity; // No limit (but bounded by portfolio creation)
    default:
      return 24 * 60 * 60 * 1000;
  }
}

/**
 * Estimate the number of points for a given timeframe and duration
 */
function estimatePointCount(timeframe: CandleTimeframe, durationMs: number): number {
  const minutesPerCandle: Record<CandleTimeframe, number> = {
    '1m': 1,
    '5m': 5,
    '1h': 60,
    '1d': 24 * 60,
  };
  
  const durationMinutes = durationMs / (60 * 1000);
  return Math.ceil(durationMinutes / minutesPerCandle[timeframe]);
}

/**
 * Select appropriate timeframe based on range and point count constraints
 * 
 * Rules:
 * - 1D: prefer 1m, fallback to 5m
 * - 1W: 5m or 1h (aim <= 2000 points)
 * - 1M: 1h (fallback 1d)
 * - 3M: 1d preferred (or 1h if portfolio age < ~10 days)
 * - ALL: 1d always
 * 
 * Automatically switches to coarser timeframe if point count would exceed ~2500
 */
function selectTimeframe(
  range: ChartRange,
  durationMs: number,
  portfolioAgeDays: number
): CandleTimeframe {
  const MAX_POINTS = 2500;
  const TARGET_POINTS = 2000;
  
  switch (range) {
    case '1D': {
      // Prefer 1m, but check point count
      const points1m = estimatePointCount('1m', durationMs);
      if (points1m <= MAX_POINTS) {
        return '1m';
      }
      // Fallback to 5m
      return '5m';
    }
    
    case '1W': {
      // Try 5m first
      const points5m = estimatePointCount('5m', durationMs);
      if (points5m <= MAX_POINTS) {
        return '5m';
      }
      // Fallback to 1h
      return '1h';
    }
    
    case '1M': {
      // Prefer 1h
      const points1h = estimatePointCount('1h', durationMs);
      if (points1h <= MAX_POINTS) {
        return '1h';
      }
      // Fallback to 1d
      return '1d';
    }
    
    case '3M': {
      // If portfolio is very new (< 10 days), use 1h
      if (portfolioAgeDays < 10) {
        const points1h = estimatePointCount('1h', durationMs);
        if (points1h <= MAX_POINTS) {
          return '1h';
        }
      }
      // Otherwise prefer 1d
      return '1d';
    }
    
    case 'ALL': {
      // Always use 1d for ALL range
      return '1d';
    }
    
    default:
      return '1h';
  }
}

/**
 * Get chart query parameters for a given range and portfolio
 * 
 * IMPORTANT: All ranges are bounded by portfolio creation date.
 * We never show data earlier than portfolio.created_at.
 * 
 * If portfolio was created recently, ranges show only what exists since creation
 * (e.g., "3M" might show only 2 hours if portfolio is 2 hours old).
 * 
 * @param params - Query parameters
 * @returns Chart query with timeframe, startTime, endTime, and optional maxPoints
 */
export function getChartQuery(params: ChartQueryParams): ChartQuery {
  const { productId, portfolioCreatedAt, range, now = new Date() } = params;
  
  // Calculate intended start time based on range
  const rangeDuration = getRangeDuration(range);
  const intendedStart = new Date(now.getTime() - rangeDuration);
  
  // Actual start is the later of: intended start OR portfolio creation
  // This ensures we never show data before the portfolio existed
  const startTime = intendedStart > portfolioCreatedAt ? intendedStart : portfolioCreatedAt;
  
  // End time is always now
  const endTime = now;
  
  // Calculate portfolio age in days (for timeframe selection)
  const portfolioAgeMs = now.getTime() - portfolioCreatedAt.getTime();
  const portfolioAgeDays = portfolioAgeMs / (24 * 60 * 60 * 1000);
  
  // Calculate actual duration we'll be querying
  const actualDurationMs = endTime.getTime() - startTime.getTime();
  
  // Select appropriate timeframe based on range and constraints
  const timeframe = selectTimeframe(range, actualDurationMs, portfolioAgeDays);
  
  // Estimate point count for selected timeframe
  const estimatedPoints = estimatePointCount(timeframe, actualDurationMs);
  
  // Set maxPoints if we're close to the limit (for safety)
  const maxPoints = estimatedPoints > 2000 ? Math.ceil(estimatedPoints * 1.1) : undefined;
  
  return {
    timeframe,
    startTime,
    endTime,
    maxPoints,
  };
}

/**
 * Helper to format date for Supabase query (ISO string)
 */
export function formatDateForQuery(date: Date): string {
  return date.toISOString();
}

