import {
  buildSecurityMap,
  classifySecurity,
  isKnownCryptoTicker,
  isLegacyCashTicker,
  isLikelyEquityCompAccount,
  makeFallbackSecurityInfo,
} from '../classify';
import type { PlaidSecurity } from '../types';

describe('isKnownCryptoTicker', () => {
  it('returns true for well-known crypto symbols (case insensitive)', () => {
    expect(isKnownCryptoTicker('BTC')).toBe(true);
    expect(isKnownCryptoTicker('eth')).toBe(true);
    expect(isKnownCryptoTicker('SoL')).toBe(true);
  });

  it('returns false for equity tickers and unknown symbols', () => {
    expect(isKnownCryptoTicker('AAPL')).toBe(false);
    expect(isKnownCryptoTicker('TSLA')).toBe(false);
    expect(isKnownCryptoTicker('')).toBe(false);
  });
});

describe('classifySecurity', () => {
  const base: PlaidSecurity = { security_id: 'sec-1' };

  it('classifies an equity security as a stock', () => {
    const info = classifySecurity({ ...base, ticker_symbol: 'AAPL', type: 'equity', name: 'Apple Inc.' });
    expect(info.ticker).toBe('AAPL');
    expect(info.assetType).toBe('stock');
    expect(info.isCrypto).toBe(false);
    expect(info.isCash).toBe(false);
    expect(info.name).toBe('Apple Inc.');
  });

  it("classifies Plaid's 'cryptocurrency' type as crypto", () => {
    const info = classifySecurity({ ...base, ticker_symbol: 'eth', type: 'cryptocurrency' });
    expect(info.assetType).toBe('crypto');
    expect(info.ticker).toBe('ETH');
    expect(info.isCrypto).toBe(true);
  });

  it('falls back to known crypto symbols when Plaid reports equity', () => {
    // Simulates the Robinhood case: crypto returned with type="equity"
    const info = classifySecurity({ ...base, ticker_symbol: 'btc', type: 'equity' });
    expect(info.assetType).toBe('crypto');
    expect(info.isCrypto).toBe(true);
  });

  it('classifies is_cash_equivalent securities as cash', () => {
    const info = classifySecurity({ ...base, ticker_symbol: 'USD', is_cash_equivalent: true });
    expect(info.assetType).toBe('cash');
    expect(info.isCash).toBe(true);
  });

  it("classifies type='cash' securities as cash", () => {
    const info = classifySecurity({ ...base, ticker_symbol: 'USD', type: 'cash' });
    expect(info.assetType).toBe('cash');
    expect(info.isCash).toBe(true);
  });

  it('falls through to name or security_id for the display ticker', () => {
    expect(classifySecurity({ ...base }).ticker).toBe('SEC-1');
    expect(classifySecurity({ ...base, name: 'Foo' }).ticker).toBe('FOO');
  });
});

describe('buildSecurityMap', () => {
  it('maps security_id → classified info for all entries', () => {
    const map = buildSecurityMap([
      { security_id: 's1', ticker_symbol: 'AAPL', type: 'equity' },
      { security_id: 's2', ticker_symbol: 'BTC', type: 'cryptocurrency' },
    ]);
    expect(map.size).toBe(2);
    expect(map.get('s1')?.assetType).toBe('stock');
    expect(map.get('s2')?.assetType).toBe('crypto');
  });

  it('returns an empty map for null/undefined input', () => {
    expect(buildSecurityMap(null).size).toBe(0);
    expect(buildSecurityMap(undefined).size).toBe(0);
    expect(buildSecurityMap([]).size).toBe(0);
  });
});

describe('makeFallbackSecurityInfo', () => {
  it('builds a stock fallback for unknown tickers', () => {
    const info = makeFallbackSecurityInfo('xyz-123');
    expect(info.ticker).toBe('XYZ-123');
    expect(info.assetType).toBe('stock');
    expect(info.isCrypto).toBe(false);
  });

  it('flags the fallback as crypto if the ticker is in the known set', () => {
    const info = makeFallbackSecurityInfo('eth');
    expect(info.assetType).toBe('crypto');
    expect(info.isCrypto).toBe(true);
  });
});

describe('isLegacyCashTicker', () => {
  it('detects CUR: prefix (case insensitive)', () => {
    expect(isLegacyCashTicker('CUR:USD')).toBe(true);
    expect(isLegacyCashTicker('cur:eur')).toBe(true);
  });

  it('returns false for normal tickers', () => {
    expect(isLegacyCashTicker('USD')).toBe(false);
    expect(isLegacyCashTicker('AAPL')).toBe(false);
  });
});

describe('isLikelyEquityCompAccount', () => {
  it.each([
    { subtype: 'stock plan', name: null },
    { subtype: 'equity', name: null },
    { subtype: null, name: 'RSU Grants' },
    { subtype: null, name: 'My ESPP' },
    { subtype: 'employee stock', name: null },
    { subtype: 'Stock Plan (E*TRADE)', name: null },
  ])('returns true for %p', (account) => {
    expect(isLikelyEquityCompAccount(account)).toBe(true);
  });

  it.each([
    { subtype: 'brokerage', name: 'Individual' },
    { subtype: 'ira', name: 'Roth IRA' },
    { subtype: null, name: null },
  ])('returns false for %p', (account) => {
    expect(isLikelyEquityCompAccount(account)).toBe(false);
  });
});
