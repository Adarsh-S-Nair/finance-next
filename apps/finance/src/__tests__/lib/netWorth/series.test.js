/**
 * @jest-environment node
 */
import {
  planRange,
  evenTimestamps,
  asOf,
  assembleNetWorthSeries,
  lastTradingSessionOpenMs,
  DEFAULT_POINTS,
} from '../../../lib/netWorth/series';

// Fixed "now" so range math is deterministic: 2026-06-19T16:00:00Z
const NOW = Date.UTC(2026, 5, 19, 16, 0, 0);
const DAY = 86_400_000;

describe('planRange', () => {
  it('uses intraday pricing for short ranges and daily for long ranges', () => {
    expect(planRange('1D', NOW).intraday).toBe(true);
    expect(planRange('1W', NOW).intraday).toBe(true);
    expect(planRange('1M', NOW).intraday).toBe(true);
    expect(planRange('3M', NOW).intraday).toBe(false);
    expect(planRange('1Y', NOW).intraday).toBe(false);
    expect(planRange('ALL', NOW).intraday).toBe(false);
  });

  it('returns a fixed point count and ends exactly at now', () => {
    for (const r of ['1D', '1W', '1M', '3M', 'YTD', '1Y', 'ALL']) {
      const plan = planRange(r, NOW);
      expect(plan.points).toBe(DEFAULT_POINTS);
      expect(plan.endMs).toBe(NOW);
      expect(plan.startMs).toBeLessThan(NOW);
    }
  });

  it('windows each range correctly', () => {
    expect(planRange('1D', NOW).startMs).toBe(NOW - DAY);
    expect(planRange('1W', NOW).startMs).toBe(NOW - 7 * DAY);
    expect(planRange('3M', NOW).startMs).toBe(NOW - 90 * DAY);
    expect(planRange('YTD', NOW).startMs).toBe(Date.UTC(2026, 0, 1));
  });

  it('floors the start at the first connection (recent connection shortens ALL)', () => {
    const connection = Date.UTC(2026, 3, 8); // 2026-04-08
    expect(planRange('ALL', NOW, connection).startMs).toBe(connection);
    // ...but an old connection does not extend past the 365d cap
    const old = Date.UTC(2023, 0, 1);
    expect(planRange('ALL', NOW, old).startMs).toBe(NOW - 365 * DAY);
  });

  it('never produces a degenerate window for a brand-new account', () => {
    const plan = planRange('ALL', NOW, NOW); // connected "now"
    expect(plan.startMs).toBeLessThan(plan.endMs);
  });
});

describe('evenTimestamps', () => {
  it('produces n evenly-spaced points ending exactly at endMs', () => {
    const ts = evenTimestamps(0, 1000, 11);
    expect(ts).toHaveLength(11);
    expect(ts[0]).toBe(0);
    expect(ts[10]).toBe(1000);
    expect(ts[5]).toBe(500);
  });

  it('collapses safely to a single point', () => {
    expect(evenTimestamps(0, 1000, 1)).toEqual([1000]);
    expect(evenTimestamps(1000, 1000, 5)).toEqual([1000]);
  });
});

describe('asOf', () => {
  const series = [
    { tMs: 10, price: 1 },
    { tMs: 20, price: 2 },
    { tMs: 30, price: 3 },
  ];
  it('returns the last point at or before t', () => {
    expect(asOf(series, 25).price).toBe(2);
    expect(asOf(series, 30).price).toBe(3);
    expect(asOf(series, 100).price).toBe(3);
  });
  it('carries the first point back when t precedes all data', () => {
    expect(asOf(series, 5).price).toBe(1);
  });
  it('handles empty input', () => {
    expect(asOf([], 5)).toBeNull();
  });
});

describe('lastTradingSessionOpenMs', () => {
  const d18_1330 = Date.UTC(2026, 5, 18, 13, 30);
  const d18_1600 = Date.UTC(2026, 5, 18, 16, 0);
  const d18_2000 = Date.UTC(2026, 5, 18, 20, 0);
  const d17_1330 = Date.UTC(2026, 5, 17, 13, 30);
  const d17_2000 = Date.UTC(2026, 5, 17, 20, 0);

  it('returns the open of the most recent session present', () => {
    const points = [
      { tMs: d17_1330, price: 1 },
      { tMs: d17_2000, price: 2 },
      { tMs: d18_1600, price: 3 },
      { tMs: d18_1330, price: 4 },
      { tMs: d18_2000, price: 5 },
    ];
    // Last date is the 18th; its earliest timestamp is 13:30.
    expect(lastTradingSessionOpenMs(points)).toBe(d18_1330);
  });

  it('returns null for empty input', () => {
    expect(lastTradingSessionOpenMs([])).toBeNull();
  });
});

describe('assembleNetWorthSeries', () => {
  it('prices investment holdings intraday and uses live balance for the last point', () => {
    const t0 = 1000;
    const t1 = 2000; // last == now
    const accounts = [
      { id: 'inv', isLiability: false, isInvestment: true, currentBalance: 1200 },
    ];
    const series = assembleNetWorthSeries({
      targets: [t0, t1],
      accounts,
      snapshotsByAccount: new Map(),
      initialBalanceByAccount: new Map(),
      holdingsByAccount: new Map([['inv', [{ ticker: 'AAA', shares: 10, isCash: false }]]]),
      priceSeries: new Map([
        ['AAA', [{ tMs: t0, price: 100 }, { tMs: t1, price: 110 }]],
      ]),
      holdingsAvailable: true,
    });

    // t0 history: 10 * 100 = 1000
    expect(series[0].netWorth).toBe(1000);
    // last point: live balance 1200 (not 10 * 110)
    expect(series[1].netWorth).toBe(1200);
  });

  it('steps cash/liabilities from snapshots and nets liabilities negative', () => {
    const t = 1500;
    const last = 3000;
    const accounts = [
      { id: 'cash', isLiability: false, isInvestment: false, currentBalance: 900 },
      { id: 'card', isLiability: true, isInvestment: false, currentBalance: 50 },
    ];
    const series = assembleNetWorthSeries({
      targets: [t, last],
      accounts,
      snapshotsByAccount: new Map([
        ['cash', [{ tMs: 1000, balance: 500 }, { tMs: 2000, balance: 800 }]],
        ['card', [{ tMs: 1000, balance: 100 }]],
      ]),
      initialBalanceByAccount: new Map([['cash', 500], ['card', 100]]),
      holdingsByAccount: new Map(),
      priceSeries: new Map(),
      holdingsAvailable: false,
    });

    // at t=1500: cash steps to 500 (snapshot at 1000), card -100 → net 400
    expect(series[0].assets).toBe(500);
    expect(series[0].liabilities).toBe(100);
    expect(series[0].netWorth).toBe(400);
    expect(series[0].accountBalances.card).toBe(-100);

    // last point uses live balances: 900 - 50 = 850
    expect(series[1].netWorth).toBe(850);
  });

  it('falls back to snapshots for investment accounts when prices are unavailable', () => {
    const t = 1500;
    const last = 3000;
    const accounts = [
      { id: 'inv', isLiability: false, isInvestment: true, currentBalance: 5000 },
    ];
    const series = assembleNetWorthSeries({
      targets: [t, last],
      accounts,
      snapshotsByAccount: new Map([['inv', [{ tMs: 1000, balance: 4200 }]]]),
      initialBalanceByAccount: new Map([['inv', 4200]]),
      holdingsByAccount: new Map([['inv', [{ ticker: 'ZZZ', shares: 3, isCash: false }]]]),
      priceSeries: new Map(),
      holdingsAvailable: false, // pricing failed
    });

    expect(series[0].netWorth).toBe(4200); // snapshot fallback
    expect(series[1].netWorth).toBe(5000); // live
  });
});
