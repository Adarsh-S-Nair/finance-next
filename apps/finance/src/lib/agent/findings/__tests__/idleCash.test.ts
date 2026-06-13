import { detectIdleCash } from "../detectors/idleCash";
import type { AccountInput } from "../types";

function account(overrides: Partial<AccountInput> = {}): AccountInput {
  return {
    id: "a1",
    name: "Robinhood Checking",
    subtype: "checking",
    balance: 15567.24,
    ...overrides,
  };
}

describe("detectIdleCash", () => {
  it("flags a large checking balance with an estimated annual yield", () => {
    const [finding, ...rest] = detectIdleCash([account()]);
    expect(rest).toHaveLength(0);
    expect(finding.type).toBe("idle_cash");
    expect(finding.severity).toBe("review");
    expect(finding.subjectId).toBe("a1");
    expect(finding.dedupeKey).toBe("idle_cash:a1");
    expect(finding.title).toBe("$15,567 sitting in Robinhood Checking");
    expect(finding.valueAnnual).toBe(623); // ~4% of 15,567
  });

  it("ignores savings accounts (presumed to already earn yield)", () => {
    expect(
      detectIdleCash([account({ subtype: "savings", balance: 66000 })]),
    ).toHaveLength(0);
  });

  it("ignores checking balances below the idle threshold", () => {
    expect(detectIdleCash([account({ balance: 4200 })])).toHaveLength(0);
  });
});
