import { resolveHoldingQuantity, resolveHoldingValue } from '../resolveHolding';
import type { PlaidHolding } from '../types';

function makeHolding(overrides: Partial<PlaidHolding> = {}): PlaidHolding {
  return {
    account_id: 'acc-1',
    security_id: 'sec-1',
    quantity: 100,
    institution_value: 10000,
    cost_basis: 5000,
    ...overrides,
  };
}

describe('resolveHoldingQuantity', () => {
  describe('1: explicit vested_quantity wins', () => {
    it('uses vested_quantity when set, even when other fields are present', () => {
      const h = makeHolding({ quantity: 100, vested_quantity: 60, unvested_quantity: 40 });
      const r = resolveHoldingQuantity(h, true);
      expect(r.quantity).toBe(60);
      expect(r.reason).toBe('explicit_vested_quantity');
    });

    it('works whether or not the account is equity comp', () => {
      const h = makeHolding({ vested_quantity: 42 });
      expect(resolveHoldingQuantity(h, true).quantity).toBe(42);
      expect(resolveHoldingQuantity(h, false).quantity).toBe(42);
    });
  });

  describe('2: derive from total - unvested', () => {
    it('derives vested = total - unvested when vested_quantity is null', () => {
      const h = makeHolding({ quantity: 100, vested_quantity: null, unvested_quantity: 25 });
      const r = resolveHoldingQuantity(h, true);
      expect(r.quantity).toBe(75);
      expect(r.reason).toBe('derived_from_total_minus_unvested');
    });

    it('floors at zero when unvested > total (sanity)', () => {
      const h = makeHolding({ quantity: 10, vested_quantity: null, unvested_quantity: 20 });
      const r = resolveHoldingQuantity(h, true);
      expect(r.quantity).toBe(0);
    });
  });

  describe('3: equity-comp account with no vesting fields → assume unvested', () => {
    it('returns 0 when vested_value is null and the account is equity comp', () => {
      const h = makeHolding({
        quantity: 100,
        vested_quantity: null,
        unvested_quantity: null,
        vested_value: null,
      });
      const r = resolveHoldingQuantity(h, true);
      expect(r.quantity).toBe(0);
      expect(r.reason).toBe('equity_comp_no_vesting_fields_assume_unvested');
    });
  });

  describe('4: non-comp account with no vesting fields → use full quantity', () => {
    it('returns full quantity when account is NOT equity comp', () => {
      const h = makeHolding({
        quantity: 100,
        vested_quantity: null,
        unvested_quantity: null,
        vested_value: null,
      });
      const r = resolveHoldingQuantity(h, false);
      expect(r.quantity).toBe(100);
      expect(r.reason).toBe('no_vesting_fields_non_comp_account_use_full_quantity');
    });
  });

  describe('5: fallback (vested_value present or quantity 0)', () => {
    it('falls through to full quantity when vested_value is set', () => {
      const h = makeHolding({
        quantity: 100,
        vested_quantity: null,
        unvested_quantity: null,
        vested_value: 12345,
      });
      const r = resolveHoldingQuantity(h, true);
      expect(r.quantity).toBe(100);
      expect(r.reason).toBe('fallback_full_quantity');
    });

    it('falls through when quantity is 0', () => {
      const h = makeHolding({
        quantity: 0,
        vested_quantity: null,
        unvested_quantity: null,
      });
      const r = resolveHoldingQuantity(h, true);
      expect(r.quantity).toBe(0);
      expect(r.reason).toBe('fallback_full_quantity');
    });
  });

  it('parses string numerics from Plaid (older sandbox payloads)', () => {
    const h = makeHolding({ quantity: '50' as unknown as number, vested_quantity: '30' as unknown as number });
    const r = resolveHoldingQuantity(h, true);
    expect(r.quantity).toBe(30);
    expect(r.rawQuantity).toBe(50);
  });
});

describe('resolveHoldingValue', () => {
  it('uses vested_value when set', () => {
    const h = makeHolding({ institution_value: 10000, vested_value: 6000 });
    const qty = resolveHoldingQuantity(h, true);
    const val = resolveHoldingValue(h, qty);
    expect(val.institutionValue).toBe(6000);
    expect(val.proRated).toBe(false);
  });

  it('pro-rates when vested quantity was derived from total - unvested', () => {
    // quantity 100, unvested 25 → vested 75
    // value should be 10000 * (75/100) = 7500
    const h = makeHolding({
      quantity: 100,
      vested_quantity: null,
      unvested_quantity: 25,
      institution_value: 10000,
      vested_value: null,
    });
    const qty = resolveHoldingQuantity(h, true);
    const val = resolveHoldingValue(h, qty);
    expect(val.institutionValue).toBe(7500);
    expect(val.proRated).toBe(true);
  });

  it('uses full institution_value in the default case', () => {
    const h = makeHolding({ quantity: 100, institution_value: 10000 });
    const qty = resolveHoldingQuantity(h, false);
    const val = resolveHoldingValue(h, qty);
    expect(val.institutionValue).toBe(10000);
    expect(val.proRated).toBe(false);
  });

  it('returns costBasis alongside the value', () => {
    const h = makeHolding({ cost_basis: 4200 });
    const qty = resolveHoldingQuantity(h, false);
    const val = resolveHoldingValue(h, qty);
    expect(val.costBasis).toBe(4200);
  });
});
