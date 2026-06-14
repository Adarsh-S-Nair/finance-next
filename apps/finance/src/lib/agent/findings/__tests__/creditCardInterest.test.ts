import { detectCreditCardInterest } from "../detectors/creditCardInterest";
import type { TransactionInput } from "../types";

const NOW = new Date("2026-06-13T00:00:00Z");

function txn(overrides: Partial<TransactionInput> = {}): TransactionInput {
  return {
    id: "t1",
    date: "2026-05-20",
    amount: -42.5,
    merchant_name: "Chase Card",
    description: "PURCHASE INTEREST CHARGE",
    category_primary: "BANK_FEES",
    category_detailed: "BANK_FEES_INTEREST_CHARGE",
    ...overrides,
  };
}

describe("detectCreditCardInterest", () => {
  it("sums interest charged over the trailing year", () => {
    const [finding, ...rest] = detectCreditCardInterest(
      [
        txn({ id: "t1", amount: -42.5, date: "2026-04-20" }),
        txn({ id: "t2", amount: -57.5, date: "2026-05-20" }),
      ],
      NOW,
    );
    expect(rest).toHaveLength(0);
    expect(finding.type).toBe("credit_card_interest");
    expect(finding.dedupeKey).toBe("credit_card_interest");
    expect(finding.title).toBe("You paid $100 in interest this year");
    expect(finding.valueAnnual).toBe(100);
    expect(finding.evidence.count).toBe(2);
    expect(finding.evidence.last_charge).toBe("2026-05-20");
  });

  it("ignores other bank fees (only interest counts)", () => {
    expect(
      detectCreditCardInterest(
        [txn({ amount: -200, category_detailed: "BANK_FEES_OVERDRAFT_FEES" })],
        NOW,
      ),
    ).toHaveLength(0);
  });

  it("does not fire below the minimum total", () => {
    expect(detectCreditCardInterest([txn({ amount: -10 })], NOW)).toHaveLength(0);
  });

  it("ignores interest older than the trailing year", () => {
    expect(
      detectCreditCardInterest([txn({ amount: -300, date: "2024-12-01" })], NOW),
    ).toHaveLength(0);
  });
});
