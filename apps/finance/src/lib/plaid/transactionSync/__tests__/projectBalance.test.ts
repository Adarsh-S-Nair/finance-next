import {
  isCheckpointChange,
  projectCurrent,
  projectionSignFor,
  shouldProjectPending,
} from '../projectBalance';

describe('isCheckpointChange', () => {
  it('flags first-time observation (null previous) as a change', () => {
    expect(isCheckpointChange(1234.56, null)).toBe(true);
  });

  it('treats Plaid returning null as a change (be conservative)', () => {
    expect(isCheckpointChange(null, 1234.56)).toBe(true);
  });

  it('returns false when values match exactly', () => {
    expect(isCheckpointChange(1234.56, 1234.56)).toBe(false);
  });

  it('absorbs sub-cent floating-point drift as no-change', () => {
    expect(isCheckpointChange(1234.56, 1234.5600000001)).toBe(false);
  });

  it('returns true on a real movement of one cent or more', () => {
    expect(isCheckpointChange(1234.57, 1234.56)).toBe(true);
  });
});

describe('projectionSignFor', () => {
  it('returns +1 for depository accounts (checking, savings)', () => {
    expect(projectionSignFor('depository')).toBe(1);
  });

  it('returns -1 for credit accounts (balance is amount owed)', () => {
    expect(projectionSignFor('credit')).toBe(-1);
  });

  it('returns -1 for loan accounts (balance is amount owed)', () => {
    expect(projectionSignFor('loan')).toBe(-1);
  });

  it('defaults to +1 for unknown / null types', () => {
    expect(projectionSignFor(null)).toBe(1);
    expect(projectionSignFor(undefined)).toBe(1);
    expect(projectionSignFor('mystery_type')).toBe(1);
  });
});

describe('projectCurrent', () => {
  it('adds delta to a checking-account checkpoint', () => {
    // $14k refund posted after the checkpoint — checking goes up.
    expect(projectCurrent(2000, 14000, 'depository')).toBe(16000);
  });

  it('subtracts spending from a checking-account checkpoint', () => {
    // -$50 Starbucks: tx.amount = -50, balance drops to 1950.
    expect(projectCurrent(2000, -50, 'depository')).toBe(1950);
  });

  it('flips sign for credit cards: spending raises owed balance', () => {
    // -$50 Starbucks on a credit card: amount owed goes UP.
    // checkpoint=500 owed, deltaSum=-50, sign=-1 → 500 + 50 = 550.
    expect(projectCurrent(500, -50, 'credit')).toBe(550);
  });

  it('flips sign for credit cards: refund lowers owed balance', () => {
    // +$14k refund into a credit card: amount owed goes DOWN.
    // checkpoint=500 owed, deltaSum=+14000, sign=-1 → 500 - 14000 = -13500
    // (overpaid card balances are negative — Plaid models them this way).
    expect(projectCurrent(500, 14000, 'credit')).toBe(-13500);
  });

  it('returns null when the checkpoint is null (cannot project)', () => {
    expect(projectCurrent(null, 100, 'depository')).toBe(null);
  });

  it('returns the checkpoint unchanged when the delta is zero', () => {
    expect(projectCurrent(2000, 0, 'depository')).toBe(2000);
  });

  it('rounds to cents to avoid float artefacts', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754; rounding cleans it.
    expect(projectCurrent(0.1, 0.2, 'depository')).toBe(0.3);
  });
});

describe('shouldProjectPending', () => {
  it('skips pending credits on depository (Chase HOLD REL MEM CR pattern)', () => {
    // The bug: a +$48,076.92 pending memo credit on a checking account
    // was being added on top of a Plaid `current` that already included
    // the underlying deposit, displaying $96,282 for an account that
    // really held $48,205.
    expect(shouldProjectPending(48076.92, 'depository')).toBe(false);
  });

  it('keeps pending debits on depository (card authorizations)', () => {
    // Card auths are universally not in Plaid's `current`; projecting
    // them gives the correct "available after pending" view.
    expect(shouldProjectPending(-25.5, 'depository')).toBe(true);
  });

  it('keeps pending charges on credit cards (raises owed balance)', () => {
    // Pending credit-card spend (negative tx amount, sign-flipped to +)
    // should add to what you owe.
    expect(shouldProjectPending(-100, 'credit')).toBe(true);
  });

  it('keeps pending refunds on credit cards (lowers owed balance)', () => {
    expect(shouldProjectPending(50, 'credit')).toBe(true);
  });

  it('keeps pending on loan accounts regardless of sign', () => {
    expect(shouldProjectPending(100, 'loan')).toBe(true);
    expect(shouldProjectPending(-100, 'loan')).toBe(true);
  });

  it('keeps pending on unknown / null type (conservative — project rather than hide)', () => {
    expect(shouldProjectPending(100, null)).toBe(true);
    expect(shouldProjectPending(-100, undefined)).toBe(true);
  });

  it('treats zero-amount pending as keep (no effect either way)', () => {
    expect(shouldProjectPending(0, 'depository')).toBe(true);
  });
});

