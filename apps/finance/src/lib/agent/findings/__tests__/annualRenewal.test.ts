import { detectAnnualRenewals } from "../detectors/annualRenewal";
import type { RecurringStreamInput } from "../types";

// Local-midnight June 13, 2026 — avoids timezone drift in the day math.
const NOW = new Date(2026, 5, 13);

function stream(overrides: Partial<RecurringStreamInput> = {}): RecurringStreamInput {
  return {
    stream_id: "s1",
    stream_type: "outflow",
    status: "MATURE",
    is_active: true,
    category_primary: "ENTERTAINMENT",
    frequency: "ANNUALLY",
    average_amount: 119.88,
    last_amount: 119.88,
    merchant_name: "Amazon Prime",
    description: "Amazon Prime",
    last_date: "2025-06-20",
    ...overrides,
  };
}

describe("detectAnnualRenewals", () => {
  it("flags an annual renewal coming up within the lead window", () => {
    const [finding, ...rest] = detectAnnualRenewals([stream()], NOW);
    expect(rest).toHaveLength(0);
    expect(finding.type).toBe("annual_renewal");
    expect(finding.severity).toBe("info");
    expect(finding.valueAnnual).toBeNull();
    expect(finding.dedupeKey).toBe("annual_renewal:s1");
    expect(finding.title).toBe("Amazon Prime renews in 7 days — about $119.88");
    expect(finding.evidence.next_date).toBe("2026-06-20");
    expect(finding.evidence.days_away).toBe(7);
  });

  it("advances a stale last_date to the next future renewal", () => {
    // Last seen two years ago → next renewal is still 2026-06-20.
    const [finding] = detectAnnualRenewals([stream({ last_date: "2024-06-20" })], NOW);
    expect(finding.evidence.next_date).toBe("2026-06-20");
    expect(finding.evidence.days_away).toBe(7);
  });

  it("does not fire when the renewal is far away", () => {
    expect(detectAnnualRenewals([stream({ last_date: "2026-01-01" })], NOW)).toHaveLength(0);
  });

  it("ignores non-annual, inactive, and inflow streams", () => {
    expect(detectAnnualRenewals([stream({ frequency: "MONTHLY" })], NOW)).toHaveLength(0);
    expect(detectAnnualRenewals([stream({ is_active: false })], NOW)).toHaveLength(0);
    expect(detectAnnualRenewals([stream({ stream_type: "inflow" })], NOW)).toHaveLength(0);
  });

  it("falls back to description when there's no merchant name", () => {
    const [finding] = detectAnnualRenewals(
      [stream({ merchant_name: null, description: "Costco Membership" })],
      NOW,
    );
    expect(finding.title).toContain("Costco Membership");
  });
});
