import { medianMonthlySpending, recentCompleteMonths } from "../spending";
import type { SpendingTxn } from "../spending";

function tx(date: string, amount: number, primary: string | null = "FOOD_AND_DRINK"): SpendingTxn {
  return { date, amount, primary };
}

describe("medianMonthlySpending", () => {
  const months = ["2026-03", "2026-04", "2026-05"];

  it("takes the median month, ignoring an outlier spike", () => {
    // Mar $1,870 · Apr $23,581 · May $8,747 → median $8,747 (mean would be $11,399)
    const txns = [
      tx("2026-03-10", -1870),
      tx("2026-04-15", -23581),
      tx("2026-05-20", -8747),
    ];
    expect(medianMonthlySpending(txns, months)).toBe(8747);
  });

  it("sums within a month and excludes internal transfers", () => {
    const txns = [
      tx("2026-03-01", -1000),
      tx("2026-03-15", -500),
      tx("2026-03-20", -9000, "TRANSFER_OUT"), // excluded
      tx("2026-04-10", -2000),
      tx("2026-05-10", -3000),
    ];
    // Mar $1,500 · Apr $2,000 · May $3,000 → median $2,000
    expect(medianMonthlySpending(txns, months)).toBe(2000);
  });

  it("treats a month with no spending as $0", () => {
    // Only one month has activity → totals [0, 0, 5000] → median 0
    expect(medianMonthlySpending([tx("2026-05-10", -5000)], months)).toBe(0);
  });

  it("ignores inflows and transactions outside the window", () => {
    const txns = [
      tx("2026-04-10", 5000), // inflow, ignored
      tx("2026-01-10", -9999), // out of window
      tx("2026-04-12", -1200),
    ];
    expect(medianMonthlySpending(txns, months)).toBe(0); // only Apr $1,200 → [0,0,1200]
  });
});

describe("recentCompleteMonths", () => {
  it("returns the N complete months before the given date", () => {
    expect(recentCompleteMonths(new Date("2026-06-13"), 3)).toEqual([
      "2026-05",
      "2026-04",
      "2026-03",
    ]);
  });
});
