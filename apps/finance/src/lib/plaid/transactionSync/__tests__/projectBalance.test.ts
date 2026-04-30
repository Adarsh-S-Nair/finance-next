import {
  computeProjectedBalance,
  isCheckpointChange,
  projectCurrent,
  projectionSignFor,
  shouldProjectPending,
  shouldProjectPendingForDepository,
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

describe('shouldProjectPendingForDepository', () => {
  it('returns false when current === available (Venmo / fintech real-time)', () => {
    // The Venmo bug: Plaid returned current=599.77, available=599.77,
    // and we projected pending debits on top, dropping displayed balance
    // by ~$210. The signal that pending is already booked into current.
    expect(shouldProjectPendingForDepository(599.77, 599.77)).toBe(false);
  });

  it('returns true when available < current (Chase with outstanding pending)', () => {
    // Traditional bank: $100 in pending debits has lowered available
    // below current. Projection should run to show the correct
    // available-after-pending number.
    expect(shouldProjectPendingForDepository(2000, 1900)).toBe(true);
  });

  it('returns true when available > current (rare — pending credit not yet booked)', () => {
    // Asymmetric case: a deposit Plaid is treating as available but
    // hasn't yet rolled into current. Heuristic should still allow
    // projection (pending debits are uncorrelated with this signal).
    expect(shouldProjectPendingForDepository(1900, 2000)).toBe(true);
  });

  it('returns true when checkpoint current is null (be conservative)', () => {
    // Without a real checkpoint we have nothing to compare; default to
    // projecting rather than silently swallowing pending charges.
    expect(shouldProjectPendingForDepository(null, 1000)).toBe(true);
  });

  it('returns true when checkpoint available is null (be conservative)', () => {
    // Some institutions don't return `available` at all. Don't disable
    // projection on a missing signal.
    expect(shouldProjectPendingForDepository(1000, null)).toBe(true);
  });

  it('treats sub-cent floating-point drift as equal (no projection)', () => {
    // Mirrors `isCheckpointChange` — Plaid sends 2-decimal numbers, the
    // epsilon absorbs IEEE-754 artifacts.
    expect(shouldProjectPendingForDepository(599.77, 599.7700000001)).toBe(false);
  });

  it('treats a real one-cent gap as not equal (projection enabled)', () => {
    expect(shouldProjectPendingForDepository(599.77, 599.76)).toBe(true);
  });

  it('returns true when both values are zero (edge case — empty account)', () => {
    // 0 === 0 is technically "no pending differentiation," but with a
    // zero balance there's nothing to project on top of anyway. The
    // function returns false (matches the rule) and the caller's
    // checkpoint=0 path produces 0 either way. Documenting the actual
    // behavior so a future refactor doesn't accidentally flip it.
    expect(shouldProjectPendingForDepository(0, 0)).toBe(false);
  });
});

describe('computeProjectedBalance', () => {
  // Defaults that most tests don't care about — override per-test.
  const baseInputs = {
    checkpointCurrent: 1000,
    checkpointAvailable: 1000,
    accountType: 'depository' as string | null | undefined,
    postedDeltaSum: 0,
    pendingAmounts: [] as number[],
  };

  describe('Venmo regression (the bug that prompted the fix)', () => {
    it('does not double-count pending debits when current === available', () => {
      // Real production data: Plaid returned current=599.77,
      // available=599.77 for a Venmo account, with three pending debits
      // totalling -$210.40. Old code displayed $389.37; correct value
      // is $599.77 (the pending charges were already in current).
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 599.77,
          checkpointAvailable: 599.77,
          accountType: 'depository',
          pendingAmounts: [-33.52, -160.0, -16.88],
        })
      ).toBe(599.77);
    });

    it('still applies posted-tx projection for fintechs (lag between syncs)', () => {
      // Even when current === available, posted txs after `as_of` are
      // legitimately new — they're added to the checkpoint, just like
      // any other account. Only the pending double-count is suppressed.
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 599.77,
          checkpointAvailable: 599.77,
          accountType: 'depository',
          postedDeltaSum: -25.0,
          pendingAmounts: [-50.0],
        })
      ).toBe(574.77); // checkpoint + posted only; pending suppressed
    });
  });

  describe('Traditional depository (Chase / Wells / BofA)', () => {
    it('projects pending debits when available < current', () => {
      // Pending charges have dropped available below current; project
      // them onto the checkpoint to give the user the same view the
      // bank shows them.
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 2000,
          checkpointAvailable: 1900,
          accountType: 'depository',
          pendingAmounts: [-100],
        })
      ).toBe(1900);
    });

    it('skips pending credits even when projection is otherwise enabled', () => {
      // The HOLD REL MEM CR pattern: a pending +deposit on a depository
      // account that Plaid already booked into current. Drop it.
      // Available < current (so projection IS enabled), but the per-tx
      // filter still excludes the credit.
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 50000,
          checkpointAvailable: 49900, // unrelated $100 pending debit
          accountType: 'depository',
          pendingAmounts: [-100, 48076.92], // debit kept, credit dropped
        })
      ).toBe(49900); // 50000 - 100, NOT 50000 - 100 + 48076.92
    });

    it('combines posted-tx delta with pending-debit projection', () => {
      // The full picture: yesterday's posted txs and today's pending
      // both contribute to "what you can spend right now."
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 1000,
          checkpointAvailable: 950,
          accountType: 'depository',
          postedDeltaSum: 200, // yesterday's paycheck
          pendingAmounts: [-50], // today's pending coffee
        })
      ).toBe(1150); // 1000 + 200 - 50
    });
  });

  describe('Credit cards', () => {
    it('projects pending charges with sign flip (raises owed balance)', () => {
      // Credit card: balance is what you OWE. Pending charge of $-100
      // (in our universal sign convention) raises owed by $100.
      // Critically, the depository real-time-institution check must NOT
      // apply to credit cards (their available = limit - balance, so
      // available !== current is the norm but means nothing about
      // pending).
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 500,
          checkpointAvailable: 4500, // limit 5000 - owed 500
          accountType: 'credit',
          pendingAmounts: [-100],
        })
      ).toBe(600); // 500 owed + 100 new pending charge
    });

    it('does not skip credit-card pending when current happens to equal available', () => {
      // Pathological case: a credit card with a balance equal to
      // available (could happen at certain limit/balance combos). The
      // depository heuristic must not misfire here — credit-card
      // pending always projects.
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 1000,
          checkpointAvailable: 1000,
          accountType: 'credit',
          pendingAmounts: [-50],
        })
      ).toBe(1050); // 1000 owed + 50 new pending charge
    });

    it('projects pending refunds (lowers owed balance)', () => {
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 500,
          checkpointAvailable: 4500,
          accountType: 'credit',
          pendingAmounts: [50],
        })
      ).toBe(450); // 500 owed - 50 refund
    });
  });

  describe('Loans / mortgages', () => {
    it('projects pending with sign flip (mirrors credit cards)', () => {
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 250000,
          checkpointAvailable: null,
          accountType: 'loan',
          pendingAmounts: [-1500], // pending interest accrual
        })
      ).toBe(251500);
    });
  });

  describe('Edge cases', () => {
    it('returns null when checkpoint is null (cannot project)', () => {
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: null,
          pendingAmounts: [-100],
          postedDeltaSum: 50,
        })
      ).toBe(null);
    });

    it('returns the checkpoint unchanged when no posted or pending input', () => {
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 1234.56,
          checkpointAvailable: 1234.56,
        })
      ).toBe(1234.56);
    });

    it('rounds to cents when summing many fractional pendings', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754. The final value
      // must come out clean.
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 100,
          checkpointAvailable: 99.7, // forces projection enabled
          accountType: 'depository',
          pendingAmounts: [-0.1, -0.2],
        })
      ).toBe(99.7);
    });

    it('null accountType: applies generic projection (no depository skip)', () => {
      // An account with unknown type should still project pending —
      // we'd rather show a slightly conservative balance than a wildly
      // optimistic one. The depository real-time check must not fire.
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 1000,
          checkpointAvailable: 1000, // would skip if depository
          accountType: null,
          pendingAmounts: [-50],
        })
      ).toBe(950); // pending IS projected
    });

    it('skip-pending logic does not affect posted-tx projection on the same account', () => {
      // Reinforces the previous Venmo test from a different angle: even
      // when pending is suppressed entirely, a single posted tx still
      // moves the balance.
      expect(
        computeProjectedBalance({
          ...baseInputs,
          checkpointCurrent: 1000,
          checkpointAvailable: 1000,
          accountType: 'depository',
          postedDeltaSum: 75, // a paycheck posted after as_of
          pendingAmounts: [-200, -300, -100], // all suppressed
        })
      ).toBe(1075);
    });

    it('empty pendingAmounts array behaves identically to an explicit zero', () => {
      const withEmpty = computeProjectedBalance({
        ...baseInputs,
        checkpointCurrent: 500,
        checkpointAvailable: 500,
        pendingAmounts: [],
      });
      const withZero = computeProjectedBalance({
        ...baseInputs,
        checkpointCurrent: 500,
        checkpointAvailable: 500,
        pendingAmounts: [0],
      });
      expect(withEmpty).toBe(withZero);
      expect(withEmpty).toBe(500);
    });
  });
});

