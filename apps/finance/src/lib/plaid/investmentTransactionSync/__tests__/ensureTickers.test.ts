import { selectInvestmentTickerCandidates } from '../ensureTickers';
import type { SecuritiesMap, ResolvedSecurity } from '../types';

function makeMap(entries: Array<[string, Partial<ResolvedSecurity>]>): SecuritiesMap {
  const map: SecuritiesMap = new Map();
  for (const [id, sec] of entries) {
    map.set(id, { ticker: null, name: null, type: null, subtype: null, ...sec });
  }
  return map;
}

describe('selectInvestmentTickerCandidates', () => {
  it('picks symbols that look like real tickers', () => {
    const map = makeMap([
      ['s1', { ticker: 'COP', type: 'equity', name: 'ConocoPhillips' }],
      ['s2', { ticker: 'BRK.B', type: 'equity', name: 'Berkshire' }],
    ]);
    expect(selectInvestmentTickerCandidates(map).map((c) => c.symbol).sort()).toEqual([
      'BRK.B',
      'COP',
    ]);
  });

  it('includes ETFs and funds (logo.dev resolves them by symbol)', () => {
    const map = makeMap([
      ['s1', { ticker: 'VOO', type: 'etf', name: 'Vanguard S&P 500 ETF' }],
      ['s2', { ticker: 'VMFXX', type: 'mutual fund', name: 'Vanguard Money Market' }],
    ]);
    expect(selectInvestmentTickerCandidates(map).map((c) => c.symbol).sort()).toEqual([
      'VMFXX',
      'VOO',
    ]);
  });

  it('classifies cash-type securities as cash, everything else as stock', () => {
    const map = makeMap([
      ['s1', { ticker: 'AAPL', type: 'equity' }],
      ['s2', { ticker: 'SWVXX', type: 'cash' }],
    ]);
    const bySymbol = Object.fromEntries(
      selectInvestmentTickerCandidates(map).map((c) => [c.symbol, c.assetType]),
    );
    expect(bySymbol).toEqual({ AAPL: 'stock', SWVXX: 'cash' });
  });

  it('upper-cases and de-duplicates symbols', () => {
    const map = makeMap([
      ['s1', { ticker: 'cop', type: 'equity' }],
      ['s2', { ticker: 'COP', type: 'equity' }],
    ]);
    expect(selectInvestmentTickerCandidates(map)).toHaveLength(1);
    expect(selectInvestmentTickerCandidates(map)[0].symbol).toBe('COP');
  });

  it('skips cash-sweep pseudo-tickers and name fallbacks', () => {
    const map = makeMap([
      ['s1', { ticker: 'CUR:USD', type: 'cash' }],
      ['s2', { ticker: 'Some Brokerage Cash Reserve', type: 'equity' }],
      ['s3', { ticker: null, type: 'equity' }],
    ]);
    expect(selectInvestmentTickerCandidates(map)).toEqual([]);
  });
});
