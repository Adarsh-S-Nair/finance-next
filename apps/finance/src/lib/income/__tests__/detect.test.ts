import {
  detectIncome,
  cadenceFromGap,
  paycheckAnomaly,
  type IncomeTxn,
  type IncomeStream,
} from '../detect';

// Convenience builder. Defaults model a Salesforce salary deposit into the
// "checking" account; override per-row as needed.
function tx(partial: Partial<IncomeTxn> & { date: string; amount: number }): IncomeTxn {
  return {
    merchant_name: null,
    description: 'Direct deposit from 100-SFDC INC.',
    category_primary: 'INCOME',
    category_detailed: 'INCOME_SALARY',
    account_id: 'acct_checking',
    ...partial,
  };
}

// A faithful fixture of the real account: ~semi-monthly Salesforce payroll
// under three different labels, a raise in April, a same-day double deposit,
// a state-refund one-off miscategorised as salary, monthly interest, plus
// noise that must be ignored (an internal transfer and an equity sale).
function realWorldLedger(): IncomeTxn[] {
  return [
    // Salesforce payroll → Robinhood Checking. Labels drift over time.
    tx({ date: '2026-02-11', amount: 3177.88, description: 'Inc.' }),
    tx({ date: '2026-02-25', amount: 3147.72, description: 'Inc.' }),
    tx({ date: '2026-03-11', amount: 3177.9, description: 'Inc.' }),
    tx({ date: '2026-03-27', amount: 3366.25, description: 'Inc.' }),
    // April: a same-day split / bonus (two lines, one pay date).
    tx({ date: '2026-04-13', amount: 5193.96, description: 'From 100-SFDC INC.' }),
    tx({ date: '2026-04-13', amount: 3354.98, description: 'From 100-SFDC INC.' }),
    // Post-raise regime.
    tx({ date: '2026-04-28', amount: 4170.19 }),
    tx({ date: '2026-05-13', amount: 4418.03 }),
    tx({ date: '2026-05-27', amount: 4800.88 }),
    tx({ date: '2026-06-11', amount: 3809.07 }),

    // State tax refund, miscategorised by Plaid as INCOME_SALARY, landing in
    // a DIFFERENT account, just once. Must NOT be read as a paycheck.
    tx({
      date: '2026-04-02',
      amount: 2055.0,
      description: 'From NY STATE',
      account_id: 'acct_savings',
    }),

    // Monthly interest — real recurring income, but not a paycheck.
    tx({
      date: '2026-03-31',
      amount: 94.32,
      description: 'Interest earned',
      category_detailed: 'INCOME_INTEREST_EARNED',
      account_id: 'acct_savings',
    }),
    tx({
      date: '2026-04-30',
      amount: 215.6,
      description: 'Interest earned',
      category_detailed: 'INCOME_INTEREST_EARNED',
      account_id: 'acct_savings',
    }),
    tx({
      date: '2026-05-29',
      amount: 231.31,
      description: 'Interest earned',
      category_detailed: 'INCOME_INTEREST_EARNED',
      account_id: 'acct_savings',
    }),

    // Noise: an internal transfer and an equity sale (null category). Both
    // look like "money in" and must be excluded from income.
    tx({
      date: '2026-06-18',
      amount: 10000,
      description: 'From Personal Checking',
      category_primary: 'TRANSFER_IN',
      category_detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER',
    }),
    tx({
      date: '2026-06-16',
      amount: 39735.69,
      description: 'Sell ESPP',
      category_primary: null,
      category_detailed: null,
    }),
  ];
}

const NOW = new Date('2026-06-26T12:00:00Z');

describe('detectIncome — real-world Salesforce ledger', () => {
  const profile = detectIncome(realWorldLedger(), NOW);
  const primary = profile.primary as IncomeStream;

  it('identifies a paycheck as the primary income stream', () => {
    expect(primary).not.toBeNull();
    expect(primary.kind).toBe('paycheck');
  });

  it('unifies the employer label variants into one stream', () => {
    // All SFDC deposits (Inc. / From 100-SFDC INC. / Direct deposit from…)
    // collapse to a single stream, labelled with the most descriptive form.
    expect(primary.label).toContain('SFDC');
    // 9 distinct pay DATES (the 04-13 double collapses to one event).
    expect(primary.deposits).toHaveLength(9);
  });

  it('reads the cadence as semi-monthly', () => {
    expect(primary.cadence).toBe('SEMIMONTHLY');
  });

  it('computes the expected amount from the recent regime (~$4,300)', () => {
    // Median of the last four deposits — robust to the April bonus and the
    // pre-raise paychecks. NOT the all-time average (~$3,900).
    expect(primary.expectedAmount).toBeGreaterThan(4200);
    expect(primary.expectedAmount).toBeLessThan(4400);
  });

  it('predicts the next paycheck on/after today', () => {
    expect(primary.nextDate).not.toBeNull();
    expect(primary.nextDate! >= '2026-06-26').toBe(true);
  });

  it('excludes the state-refund one-off from the paycheck', () => {
    // It must not be a deposit in the paycheck stream...
    expect(primary.deposits.some((d) => d.amount === 2055)).toBe(false);
    // ...and it should surface as an excluded one-off instead.
    expect(
      profile.excluded.oneOffs.some((o) => o.label.includes('NY STATE')),
    ).toBe(true);
  });

  it('excludes transfers and equity sales from income entirely', () => {
    expect(profile.excluded.transfers).toBe(1);
    const allDeposits = profile.streams.flatMap((s) => s.deposits.map((d) => d.amount));
    expect(allDeposits).not.toContain(10000); // transfer
    expect(allDeposits).not.toContain(39735.69); // equity sale
  });

  it('detects interest as a separate, non-paycheck stream', () => {
    const interest = profile.streams.find((s) => s.kind === 'interest');
    expect(interest).toBeDefined();
    expect(interest!.cadence).toBe('MONTHLY');
  });

  it('rolls the paycheck into monthly income alongside interest', () => {
    // Semi-monthly ~$4,294 → ~$8,588/mo, plus ~$215/mo interest.
    expect(profile.monthlyIncome).toBeGreaterThan(8500);
    expect(profile.monthlyIncome).toBeLessThan(9000);
  });

  it('does not flag the latest paycheck as anomalous (within 15%)', () => {
    // $3,809 vs ~$4,294 expected = ~11% low — notable but under threshold.
    expect(paycheckAnomaly(primary)).toBeNull();
  });
});

describe('paycheckAnomaly', () => {
  const base: IncomeStream = {
    key: 'k',
    label: 'Employer',
    kind: 'paycheck',
    cadence: 'BIWEEKLY',
    expectedAmount: 4000,
    lastAmount: 4000,
    lastDate: '2026-06-11',
    nextDate: '2026-06-25',
    monthlyEquivalent: 8667,
    confidence: 0.9,
    deposits: [],
  };

  it('flags a paycheck materially below expected', () => {
    const a = paycheckAnomaly({ ...base, lastAmount: 3000 });
    expect(a).not.toBeNull();
    expect(a!.direction).toBe('lower');
    expect(a!.pct).toBeCloseTo(0.25, 2);
  });

  it('flags a paycheck materially above expected', () => {
    const a = paycheckAnomaly({ ...base, lastAmount: 5200 });
    expect(a!.direction).toBe('higher');
  });

  it('ignores small deviations', () => {
    expect(paycheckAnomaly({ ...base, lastAmount: 4200 })).toBeNull();
  });
});

describe('cadenceFromGap', () => {
  it.each([
    [7, 'WEEKLY'],
    [14, 'BIWEEKLY'],
    [15, 'SEMIMONTHLY'],
    [30, 'MONTHLY'],
    [90, 'IRREGULAR'],
  ])('maps a %d-day gap to %s', (gap, expected) => {
    expect(cadenceFromGap(gap)).toBe(expected);
  });
});

describe('detectIncome — edge cases', () => {
  it('does not treat a single deposit as a recurring paycheck', () => {
    const profile = detectIncome([tx({ date: '2026-06-11', amount: 4000 })], NOW);
    expect(profile.primary).toBeNull();
    expect(profile.excluded.oneOffs).toHaveLength(1);
  });

  it('handles a clean monthly salary', () => {
    const txns = [
      tx({ date: '2026-03-31', amount: 5000 }),
      tx({ date: '2026-04-30', amount: 5000 }),
      tx({ date: '2026-05-29', amount: 5000 }),
    ];
    const profile = detectIncome(txns, NOW);
    expect(profile.primary!.cadence).toBe('MONTHLY');
    expect(profile.primary!.expectedAmount).toBe(5000);
    expect(profile.monthlyIncome).toBe(5000);
  });

  it('returns an empty profile when there is no income', () => {
    const profile = detectIncome(
      [
        tx({
          date: '2026-06-18',
          amount: 9000,
          category_primary: 'TRANSFER_IN',
          category_detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER',
        }),
      ],
      NOW,
    );
    expect(profile.primary).toBeNull();
    expect(profile.streams).toHaveLength(0);
    expect(profile.monthlyIncome).toBe(0);
  });
});
