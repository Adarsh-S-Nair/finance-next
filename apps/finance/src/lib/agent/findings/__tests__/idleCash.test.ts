import { detectIdleCash } from "../detectors/idleCash";
import type { AccountInput } from "../types";

function account(overrides: Partial<AccountInput> = {}): AccountInput {
  return {
    id: "a1",
    name: "Robinhood Checking",
    subtype: "checking",
    balance: 15567,
    ...overrides,
  };
}

describe("detectIdleCash", () => {
  it("flags only the excess over a one-month spending buffer", () => {
    // $15,567 balance, $5,000/mo spending → $5,000 buffer → $10,567 excess
    const [finding, ...rest] = detectIdleCash([account()], 5000);
    expect(rest).toHaveLength(0);
    expect(finding.type).toBe("idle_cash");
    expect(finding.title).toBe("$10,567 of your checking is sitting idle");
    expect(finding.valueAnnual).toBe(423); // ~4% of 10,567
    expect(finding.evidence.buffer).toBe(5000);
    expect(finding.evidence.excess).toBe(10567);
  });

  it("respects high spenders: a bigger buffer leaves less idle", () => {
    // $11,399/mo spending → buffer eats most of the balance
    const [finding] = detectIdleCash([account()], 11399);
    expect(finding.title).toBe("$4,168 of your checking is sitting idle");
    expect(finding.valueAnnual).toBe(167);
  });

  it("does not fire when the balance is within the buffer + threshold", () => {
    // $6,000 balance, $5,000 buffer → only $1,000 excess (< $2,000 min)
    expect(detectIdleCash([account({ balance: 6000 })], 5000)).toHaveLength(0);
  });

  it("does not guess without a spending estimate", () => {
    expect(detectIdleCash([account()], 0)).toHaveLength(0);
  });

  it("ignores savings accounts (presumed to already earn yield)", () => {
    expect(
      detectIdleCash([account({ subtype: "savings", balance: 66000 })], 5000),
    ).toHaveLength(0);
  });
});
