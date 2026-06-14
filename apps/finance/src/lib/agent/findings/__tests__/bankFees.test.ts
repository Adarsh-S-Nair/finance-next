import { detectBankFees } from "../detectors/bankFees";
import type { TransactionInput } from "../types";

const NOW = new Date("2026-06-13T00:00:00Z");

function txn(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    id: "t1",
    date: "2026-05-01",
    amount: -35,
    merchant_name: "Chase",
    description: "OVERDRAFT FEE",
    category_primary: "BANK_FEES",
    category_detailed: "BANK_FEES_OVERDRAFT_FEES",
    ...overrides,
  };
}

describe("detectBankFees", () => {
  it("sums avoidable fees over the trailing year", () => {
    const [finding, ...rest] = detectBankFees(
      [
        txn({ id: "t1", amount: -35, category_detailed: "BANK_FEES_OVERDRAFT_FEES" }),
        txn({ id: "t2", amount: -3, category_detailed: "BANK_FEES_ATM_FEES" }),
        txn({ id: "t3", amount: -35, category_detailed: "BANK_FEES_OVERDRAFT_FEES" }),
      ],
      NOW,
    );
    expect(rest).toHaveLength(0);
    expect(finding.type).toBe("bank_fees");
    expect(finding.dedupeKey).toBe("bank_fees");
    expect(finding.title).toBe("You've paid $73 in bank fees this year");
    expect(finding.valueAnnual).toBe(73);
    expect(finding.evidence.count).toBe(3);
    // Largest bucket (overdraft $70) leads the breakdown.
    expect(finding.evidence.by_type).toEqual({
      "Overdraft fees": 70,
      "ATM fees": 3,
    });
  });

  it("excludes interest charges (those are their own finding)", () => {
    // $400 interest + $40 ATM → the fee total is $40, not $440.
    const [finding] = detectBankFees(
      [
        txn({ amount: -400, category_detailed: "BANK_FEES_INTEREST_CHARGE" }),
        txn({ amount: -40, category_detailed: "BANK_FEES_ATM_FEES" }),
      ],
      NOW,
    );
    expect(finding.valueAnnual).toBe(40);
    expect(finding.evidence.total).toBe(40);
  });

  it("ignores non-fee categories", () => {
    expect(
      detectBankFees(
        [txn({ category_primary: "FOOD_AND_DRINK", category_detailed: null, amount: -200 })],
        NOW,
      ),
    ).toHaveLength(0);
  });

  it("does not fire below the minimum total", () => {
    expect(
      detectBankFees([txn({ amount: -10, category_detailed: "BANK_FEES_ATM_FEES" })], NOW),
    ).toHaveLength(0);
  });

  it("ignores fees older than the trailing year", () => {
    expect(detectBankFees([txn({ date: "2024-01-01", amount: -50 })], NOW)).toHaveLength(0);
  });

  it("ignores refunded fees (positive amounts)", () => {
    expect(detectBankFees([txn({ amount: 35 })], NOW)).toHaveLength(0);
  });
});
