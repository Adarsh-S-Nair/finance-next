import {
  type RecurringStream,
  estimatedMonthlyTotal,
  frequencyLabel,
  monthlyAmount,
  nextDateLabel,
  splitStreams,
  streamName,
} from '../lib';

function stream(overrides: Partial<RecurringStream>): RecurringStream {
  return {
    stream_id: 'stream-1',
    stream_type: 'outflow',
    description: null,
    merchant_name: null,
    frequency: 'MONTHLY',
    predicted_next_date: null,
    average_amount: 10,
    last_amount: 10,
    is_active: true,
    ...overrides,
  };
}

describe('monthlyAmount', () => {
  it('passes monthly amounts through unchanged', () => {
    expect(monthlyAmount(stream({ frequency: 'MONTHLY', average_amount: 15.99 }))).toBeCloseTo(15.99);
  });

  it('scales weekly to ~4.33x per month', () => {
    expect(monthlyAmount(stream({ frequency: 'WEEKLY', average_amount: 12 }))).toBeCloseTo(52, 0);
  });

  it('scales biweekly to ~2.17x per month', () => {
    expect(monthlyAmount(stream({ frequency: 'BIWEEKLY', average_amount: 100 }))).toBeCloseTo(216.67, 1);
  });

  it('spreads annual charges across 12 months', () => {
    expect(monthlyAmount(stream({ frequency: 'ANNUALLY', average_amount: 120 }))).toBeCloseTo(10);
  });

  it('counts unknown frequency once a month rather than dropping it', () => {
    expect(monthlyAmount(stream({ frequency: 'UNKNOWN', average_amount: 50 }))).toBe(50);
    expect(monthlyAmount(stream({ frequency: null, average_amount: 50 }))).toBe(50);
  });
});

describe('estimatedMonthlyTotal', () => {
  it('sums normalized amounts across streams', () => {
    const total = estimatedMonthlyTotal([
      stream({ frequency: 'MONTHLY', average_amount: 15 }),
      stream({ frequency: 'ANNUALLY', average_amount: 120 }),
    ]);
    expect(total).toBeCloseTo(25);
  });

  it('is zero for no streams', () => {
    expect(estimatedMonthlyTotal([])).toBe(0);
  });
});

describe('splitStreams', () => {
  it('separates outflows from inflows and sorts each by next date, undated last', () => {
    const { outflows, inflows } = splitStreams([
      stream({ stream_id: 'a', predicted_next_date: null }),
      stream({ stream_id: 'b', predicted_next_date: '2026-06-20' }),
      stream({ stream_id: 'c', predicted_next_date: '2026-06-14' }),
      stream({ stream_id: 'd', stream_type: 'inflow', predicted_next_date: '2026-06-15' }),
    ]);
    expect(outflows.map((s) => s.stream_id)).toEqual(['c', 'b', 'a']);
    expect(inflows.map((s) => s.stream_id)).toEqual(['d']);
  });
});

describe('nextDateLabel', () => {
  const now = new Date(2026, 5, 12); // 2026-06-12 local

  it('labels today and tomorrow', () => {
    expect(nextDateLabel('2026-06-12', now)).toBe('Today');
    expect(nextDateLabel('2026-06-13', now)).toBe('Tomorrow');
  });

  it('counts days under a month, falls back to a date beyond', () => {
    expect(nextDateLabel('2026-06-19', now)).toBe('In 7 days');
    expect(nextDateLabel('2026-08-01', now)).toBe('Aug 1');
  });

  it('reads past predictions as Due, not negative days', () => {
    expect(nextDateLabel('2026-06-10', now)).toBe('Due');
  });

  it('handles missing or malformed dates', () => {
    expect(nextDateLabel(null, now)).toBe('—');
    expect(nextDateLabel('not-a-date', now)).toBe('—');
  });
});

describe('streamName and frequencyLabel', () => {
  it('prefers merchant name, then description, then Unknown', () => {
    expect(streamName(stream({ merchant_name: 'Netflix', description: 'NFLX' }))).toBe('Netflix');
    expect(streamName(stream({ description: 'NFLX' }))).toBe('NFLX');
    expect(streamName(stream({}))).toBe('Unknown');
  });

  it('maps Plaid frequencies to copy, defaulting to Irregular', () => {
    expect(frequencyLabel('MONTHLY')).toBe('Monthly');
    expect(frequencyLabel('SEMI_MONTHLY')).toBe('Twice a month');
    expect(frequencyLabel('SOMETHING_NEW')).toBe('Irregular');
    expect(frequencyLabel(null)).toBe('Irregular');
  });
});
