import { formatInvestmentTransaction } from '../../lib/investmentTransactionDisplay';

describe('formatInvestmentTransaction', () => {
  it('returns null for non-investment transactions', () => {
    expect(
      formatInvestmentTransaction({ transaction_source: null, description: 'Starbucks' })
    ).toBeNull();
  });

  it('formats a sell with the ticker symbol and per-share price', () => {
    const result = formatInvestmentTransaction({
      transaction_source: 'investments',
      description: 'sell - sell 0.267 shares of ConocoPhillips for $92.76 each',
      investment_details: {
        type: 'sell',
        quantity: 0.267,
        price: 92.76,
        security_name: 'ConocoPhillips',
        ticker: 'COP',
      },
    });
    expect(result).toMatchObject({
      title: 'Sold 0.267 COP',
      subtitle: '$92.76/share',
      iconName: 'FiTrendingDown',
    });
  });

  it('leads the title with the ticker over the security name', () => {
    const result = formatInvestmentTransaction({
      transaction_source: 'investments',
      investment_details: { type: 'buy', quantity: 1.309, price: 68.92, ticker: 'TEM', security_name: 'Tempus AI Inc.' },
    });
    expect(result?.title).toBe('Bought 1.309 TEM');
    expect(result?.iconName).toBe('FiTrendingUp');
  });

  it('falls back to the security name when there is no ticker', () => {
    const result = formatInvestmentTransaction({
      transaction_source: 'investments',
      investment_details: { type: 'buy', quantity: 1.309, security_name: 'Tempus AI' },
    });
    expect(result?.title).toBe('Bought 1.309 Tempus AI');
  });

  it('formats a cash dividend with the ticker', () => {
    const result = formatInvestmentTransaction({
      transaction_source: 'investments',
      description: 'cash - Cash dividend of $0.01 from NVDA',
      investment_details: { type: 'cash', subtype: 'dividend', ticker: 'NVDA', security_name: 'NVIDIA' },
    });
    expect(result).toMatchObject({ title: 'Dividend · NVDA', subtitle: 'Cash dividend' });
  });

  it('trims trailing zeros from share quantities', () => {
    const result = formatInvestmentTransaction({
      transaction_source: 'investments',
      investment_details: { type: 'buy', quantity: 0.5, security_name: 'Apple' },
    });
    expect(result?.title).toBe('Bought 0.5 Apple');
  });

  it('falls back to a cleaned-up description when structure is missing', () => {
    const result = formatInvestmentTransaction({
      transaction_source: 'investments',
      description: 'sell - sell 0.5 shares of Foo',
      investment_details: { type: 'sell' },
    });
    // No security label → strip the redundant "sell - " prefix from the raw name.
    expect(result?.title).toBe('sell 0.5 shares of Foo');
  });
});
