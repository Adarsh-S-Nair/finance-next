import { detectSubscriptionPriceIncreases } from "../detectors/subscriptionPriceIncrease";
import type { RecurringStreamInput } from "../types";

function stream(overrides: Partial<RecurringStreamInput> = {}): RecurringStreamInput {
  return {
    stream_id: "s1",
    stream_type: "outflow",
    status: "MATURE",
    is_active: true,
    category_primary: "ENTERTAINMENT",
    frequency: "MONTHLY",
    average_amount: 9.69,
    last_amount: 13.7,
    merchant_name: "Spotify",
    description: "Spotify",
    last_date: "2026-06-12",
    ...overrides,
  };
}

describe("detectSubscriptionPriceIncreases", () => {
  it("flags a real subscription price increase (Spotify 9.69 → 13.70)", () => {
    const [finding, ...rest] = detectSubscriptionPriceIncreases([stream()]);
    expect(rest).toHaveLength(0);
    expect(finding.type).toBe("subscription_price_increase");
    expect(finding.severity).toBe("review");
    expect(finding.subjectId).toBe("s1");
    expect(finding.dedupeKey).toBe("subscription_price_increase:s1");
    expect(finding.title).toContain("Spotify");
    expect(finding.title).toContain("$13.70");
    // ~$4.01/mo × 12 ≈ $48/yr
    expect(finding.valueAnnual).toBe(48);
    expect(finding.evidence.increase_pct).toBe(41);
  });

  it("annualizes by frequency (weekly increase scales by 52)", () => {
    const [finding] = detectSubscriptionPriceIncreases([
      stream({ frequency: "WEEKLY", average_amount: 10, last_amount: 12 }),
    ]);
    expect(finding.valueAnnual).toBe(104); // $2/wk × 52
  });

  it("ignores increases below the ratio/delta thresholds", () => {
    // +5% and only $0.50 — noise, not a real hike
    expect(
      detectSubscriptionPriceIncreases([
        stream({ average_amount: 10, last_amount: 10.5 }),
      ]),
    ).toHaveLength(0);
  });

  it("ignores non-subscription categories (transfers, utilities, loans)", () => {
    for (const category_primary of [
      "TRANSFER_OUT",
      "RENT_AND_UTILITIES",
      "LOAN_PAYMENTS",
      "GENERAL_MERCHANDISE",
    ]) {
      expect(
        detectSubscriptionPriceIncreases([
          stream({ category_primary, average_amount: 100, last_amount: 150 }),
        ]),
      ).toHaveLength(0);
    }
  });

  it("ignores inactive, immature, and inflow streams", () => {
    expect(detectSubscriptionPriceIncreases([stream({ is_active: false })])).toHaveLength(0);
    expect(detectSubscriptionPriceIncreases([stream({ status: "EARLY_DETECTION" })])).toHaveLength(0);
    expect(detectSubscriptionPriceIncreases([stream({ stream_type: "inflow" })])).toHaveLength(0);
  });

  it("falls back to description when there's no merchant name", () => {
    const [finding] = detectSubscriptionPriceIncreases([
      stream({ merchant_name: null, description: "Push Fitness" }),
    ]);
    expect(finding.title).toContain("Push Fitness");
  });
});
