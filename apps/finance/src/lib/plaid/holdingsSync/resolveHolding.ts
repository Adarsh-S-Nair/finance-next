/**
 * Pure RSU-aware quantity and institution-value resolution for a single
 * Plaid holding.
 *
 * This is by far the trickiest part of the holdings pipeline — the rules
 * around vested/unvested/cost-basis interact badly across brokers, and
 * every branch below corresponds to a real bug someone filed. Please
 * leave the branches explicit and keep the tests honest.
 */

import type {
  PlaidHolding,
  ResolvedQuantity,
  ResolvedValue,
} from './types';

function toNumber(value: unknown): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/**
 * Decide how many shares of a Plaid holding we should store, taking
 * vesting into account.
 *
 * Precedence (matches legacy behavior exactly):
 *
 *   1. `vested_quantity` is explicitly set → use it.
 *   2. `vested_quantity` is null but `unvested_quantity` is set and
 *      `quantity > 0` → derive vested as `quantity - unvested_quantity`.
 *   3. Both vesting fields are null, `vested_value` is null, `quantity > 0`,
 *      and the account looks like an equity-compensation account →
 *      assume the grant is fully UNVESTED, return 0. This prevents us
 *      from over-reporting RSU grants that haven't started vesting.
 *   4. Both vesting fields are null, `vested_value` is null, `quantity > 0`,
 *      and it's NOT an equity-comp account → assume the holding is fully
 *      vested, return the raw quantity.
 *   5. Fallback: Plaid's docs say "assume all vested when vested_quantity
 *      is null," so return the raw quantity.
 */
export function resolveHoldingQuantity(
  holding: PlaidHolding,
  isLikelyEquityCompAccount: boolean
): ResolvedQuantity {
  const rawQuantity = toNumber(holding.quantity);
  const rawVestedQuantity = toNullableNumber(holding.vested_quantity);
  const rawUnvestedQuantity = toNullableNumber(holding.unvested_quantity);
  const vestedValueIsNull = holding.vested_value == null;

  if (rawVestedQuantity != null) {
    return {
      quantity: rawVestedQuantity,
      rawQuantity,
      rawVestedQuantity,
      rawUnvestedQuantity,
      reason: 'explicit_vested_quantity',
    };
  }

  if (rawUnvestedQuantity != null && rawQuantity > 0) {
    return {
      quantity: Math.max(rawQuantity - rawUnvestedQuantity, 0),
      rawQuantity,
      rawVestedQuantity,
      rawUnvestedQuantity,
      reason: 'derived_from_total_minus_unvested',
    };
  }

  if (vestedValueIsNull && rawQuantity > 0 && isLikelyEquityCompAccount) {
    return {
      quantity: 0,
      rawQuantity,
      rawVestedQuantity,
      rawUnvestedQuantity,
      reason: 'equity_comp_no_vesting_fields_assume_unvested',
    };
  }

  if (vestedValueIsNull && rawQuantity > 0) {
    return {
      quantity: rawQuantity,
      rawQuantity,
      rawVestedQuantity,
      rawUnvestedQuantity,
      reason: 'no_vesting_fields_non_comp_account_use_full_quantity',
    };
  }

  return {
    quantity: rawQuantity,
    rawQuantity,
    rawVestedQuantity,
    rawUnvestedQuantity,
    reason: 'fallback_full_quantity',
  };
}

/**
 * Decide the institution_value we should store for a holding given the
 * already-resolved quantity.
 *
 * Precedence:
 *   1. `vested_value` is set → use it directly.
 *   2. We derived vested quantity via option 2 of `resolveHoldingQuantity`
 *      (i.e. `quantity < rawQuantity`) → pro-rate the total institution
 *      value by `resolvedQuantity / rawQuantity`.
 *   3. Fallback: use the raw institution_value.
 */
export function resolveHoldingValue(
  holding: PlaidHolding,
  resolved: ResolvedQuantity
): ResolvedValue {
  const totalInstitutionValue = toNumber(holding.institution_value);
  const costBasis = toNumber(holding.cost_basis);

  if (holding.vested_value != null) {
    return {
      institutionValue: toNumber(holding.vested_value),
      totalInstitutionValue,
      costBasis,
      proRated: false,
    };
  }

  if (
    resolved.rawUnvestedQuantity != null &&
    resolved.rawQuantity > 0 &&
    resolved.quantity < resolved.rawQuantity
  ) {
    return {
      institutionValue: totalInstitutionValue * (resolved.quantity / resolved.rawQuantity),
      totalInstitutionValue,
      costBasis,
      proRated: true,
    };
  }

  return {
    institutionValue: totalInstitutionValue,
    totalInstitutionValue,
    costBasis,
    proRated: false,
  };
}
