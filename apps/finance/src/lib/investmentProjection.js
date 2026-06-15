/**
 * investmentProjection
 *
 * Pure math helpers for the investments-page growth calculator. No React, no
 * I/O — just compounding so the same functions can power the inline widget and
 * the full-screen modal (and be unit-tested in isolation).
 *
 * "Growth" mode models a traditional appreciation-based portfolio (broad-market
 * ETFs like VOO/VTI): a starting balance plus recurring contributions compounding
 * at an assumed annual return, with monthly compounding so the curve matches what
 * a brokerage actually shows. A future "Dividend" mode will live alongside this
 * and model yield + DRIP separately.
 */

/**
 * Project a growth-investing balance forward year by year.
 *
 * @param {Object} opts
 * @param {number} opts.initial            Starting balance (today's principal).
 * @param {number} opts.monthly            Recurring monthly contribution.
 * @param {number} opts.annualReturnPct    Assumed annual return, e.g. 7 for 7%.
 * @param {number} opts.years              Time horizon in years.
 * @param {number} [opts.annualIncreasePct] Yearly % bump to the monthly contribution
 *                                          (raises, inflation-tracking). Default 0.
 * @returns {{
 *   points: Array<{ year: number, balance: number, contributed: number, growth: number }>,
 *   finalBalance: number,
 *   totalContributed: number,
 *   totalGrowth: number,
 * }}
 */
export function projectGrowth({
  initial = 0,
  monthly = 0,
  annualReturnPct = 0,
  years = 0,
  annualIncreasePct = 0,
} = {}) {
  const init = Math.max(0, Number(initial) || 0);
  const yrs = Math.max(0, Math.round(Number(years) || 0));
  const monthlyRate = (Number(annualReturnPct) || 0) / 100 / 12;
  const increase = (Number(annualIncreasePct) || 0) / 100;

  let balance = init;
  let contributed = init;
  let monthlyContribution = Math.max(0, Number(monthly) || 0);

  const points = [{ year: 0, balance, contributed, growth: 0 }];

  for (let y = 1; y <= yrs; y++) {
    for (let m = 0; m < 12; m++) {
      // Interest first, then the contribution lands at month end. Standard
      // ordinary-annuity convention — keeps results in line with common
      // compound-interest calculators.
      balance = balance * (1 + monthlyRate) + monthlyContribution;
      contributed += monthlyContribution;
    }
    points.push({
      year: y,
      balance,
      contributed,
      growth: balance - contributed,
    });
    // Step up next year's contribution (e.g. annual raise).
    monthlyContribution *= 1 + increase;
  }

  return {
    points,
    finalBalance: balance,
    totalContributed: contributed,
    totalGrowth: balance - contributed,
  };
}
