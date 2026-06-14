import { selectStockTickers } from '../ensureTickers';
import type { SecuritiesMap, ResolvedSecurity } from '../types';

function makeMap(entries: Array<[string, Partial<ResolvedSecurity>]>): SecuritiesMap {
  const map: SecuritiesMap = new Map();
  for (const [id, sec] of entries) {
    map.set(id, { ticker: null, name: null, type: null, subtype: null, ...sec });
  }
  return map;
}

describe('selectStockTickers', () => {
  it('picks equities with plausible ticker symbols', () => {
    const map = makeMap([
      ['s1', { ticker: 'COP', type: 'equity' }],
      ['s2', { ticker: 'BRK.B', type: 'equity' }],
    ]);
    expect(selectStockTickers(map).sort()).toEqual(['BRK.B', 'COP']);
  });

  it('upper-cases and de-duplicates tickers', () => {
    const map = makeMap([
      ['s1', { ticker: 'cop', type: 'equity' }],
      ['s2', { ticker: 'COP', type: 'equity' }],
    ]);
    expect(selectStockTickers(map)).toEqual(['COP']);
  });

  it('skips non-equity types (etf, cash, mutual fund)', () => {
    const map = makeMap([
      ['s1', { ticker: 'VOO', type: 'etf' }],
      ['s2', { ticker: 'VMFXX', type: 'mutual fund' }],
      ['s3', { ticker: 'AAPL', type: 'equity' }],
    ]);
    expect(selectStockTickers(map)).toEqual(['AAPL']);
  });

  it('skips cash-sweep pseudo-tickers and name fallbacks', () => {
    const map = makeMap([
      ['s1', { ticker: 'CUR:USD', type: 'cash' }],
      ['s2', { ticker: 'Some Brokerage Cash Reserve', type: 'equity' }],
      ['s3', { ticker: null, type: 'equity' }],
    ]);
    expect(selectStockTickers(map)).toEqual([]);
  });
});
