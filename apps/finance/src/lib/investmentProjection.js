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
 * a brokerage actually shows.
 *
 * "Dividend" mode models income investing: share-price appreciation plus a
 * dividend yield paid monthly. Dividends either reinvest (DRIP — they compound
 * the balance) or accumulate as cash income. A dividend-growth rate lets the
 * yield-on-invested-capital climb over time, and the headline number is the
 * forward annual dividend income (the passive-income stream).
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

/**
 * Project a dividend-investing portfolio forward year by year.
 *
 * @param {Object} opts
 * @param {number} opts.initial             Starting balance.
 * @param {number} opts.monthly             Recurring monthly contribution.
 * @param {number} opts.dividendYieldPct    Starting annual dividend yield, e.g. 3.5.
 * @param {number} opts.dividendGrowthPct   Annual % the dividend itself grows
 *                                           (raises yield-on-invested-capital). Default 0.
 * @param {number} opts.priceAppreciationPct Annual share-price appreciation, e.g. 4.
 * @param {boolean} opts.reinvest           DRIP: reinvest dividends back into the balance.
 * @param {number} opts.years               Time horizon in years.
 * @param {number} [opts.annualIncreasePct] Yearly % bump to the monthly contribution.
 * @returns {{
 *   points: Array<{ year, balance, contributed, dividends, annualIncome }>,
 *   finalBalance: number,
 *   totalContributed: number,
 *   totalDividends: number,
 *   finalAnnualIncome: number,
 * }}
 */
export function projectDividend({
  initial = 0,
  monthly = 0,
  dividendYieldPct = 0,
  dividendGrowthPct = 0,
  priceAppreciationPct = 0,
  reinvest = true,
  years = 0,
  annualIncreasePct = 0,
} = {}) {
  const yrs = Math.max(0, Math.round(Number(years) || 0));
  const monthlyPriceRate = (Number(priceAppreciationPct) || 0) / 100 / 12;
  const baseYield = Math.max(0, Number(dividendYieldPct) || 0) / 100;
  const divGrowth = (Number(dividendGrowthPct) || 0) / 100;
  const increase = (Number(annualIncreasePct) || 0) / 100;

  let balance = Math.max(0, Number(initial) || 0);
  let contributed = balance;
  let cashIncome = 0; // dividends taken as cash (when not reinvesting)
  let totalDividends = 0;
  let monthlyContribution = Math.max(0, Number(monthly) || 0);

  const yieldForYear = (y) => baseYield * Math.pow(1 + divGrowth, Math.max(0, y - 1));

  const points = [
    { year: 0, balance, contributed, dividends: 0, annualIncome: balance * baseYield },
  ];

  for (let y = 1; y <= yrs; y++) {
    const monthlyYield = yieldForYear(y) / 12;
    for (let m = 0; m < 12; m++) {
      // Price appreciation on the held balance.
      balance *= 1 + monthlyPriceRate;
      // Dividend paid on the current market value.
      const dividend = balance * monthlyYield;
      totalDividends += dividend;
      if (reinvest) balance += dividend; // DRIP compounds the balance
      else cashIncome += dividend; // otherwise it accrues as income
      // Fresh contribution lands at month end.
      balance += monthlyContribution;
      contributed += monthlyContribution;
    }
    points.push({
      year: y,
      balance,
      contributed,
      dividends: totalDividends,
      annualIncome: balance * yieldForYear(y),
    });
    monthlyContribution *= 1 + increase;
  }

  return {
    points,
    finalBalance: balance,
    totalContributed: contributed,
    totalDividends,
    cashIncome,
    finalAnnualIncome: balance * yieldForYear(Math.max(1, yrs)),
  };
}
