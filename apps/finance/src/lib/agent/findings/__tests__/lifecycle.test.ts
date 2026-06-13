import { decideStatus } from "../lifecycle";

describe("decideStatus", () => {
  it("marks a brand-new finding as new", () => {
    expect(decideStatus(undefined, 273)).toBe("new");
  });

  it("leaves an active finding's status untouched", () => {
    expect(decideStatus({ status: "seen", value_annual: 273 }, 280)).toBe("seen");
    expect(decideStatus({ status: "new", value_annual: 273 }, 999)).toBe("new");
  });

  it("keeps a dismissed finding dismissed when the situation is unchanged", () => {
    expect(decideStatus({ status: "dismissed", value_annual: 273 }, 280)).toBe("dismissed");
  });

  it("keeps a dismissed finding dismissed when it gets smaller", () => {
    expect(decideStatus({ status: "dismissed", value_annual: 273 }, 150)).toBe("dismissed");
  });

  it("re-surfaces a dismissed finding once it grows ≥20%", () => {
    // $273 → $400 is +47% → comes back
    expect(decideStatus({ status: "dismissed", value_annual: 273 }, 400)).toBe("new");
  });

  it("does not re-surface on small growth under the threshold", () => {
    // $273 → $300 is +10% → stays dismissed
    expect(decideStatus({ status: "dismissed", value_annual: 273 }, 300)).toBe("dismissed");
  });

  it("never re-surfaces when values are unknown", () => {
    expect(decideStatus({ status: "dismissed", value_annual: null }, 1000)).toBe("dismissed");
    expect(decideStatus({ status: "acted", value_annual: 100 }, null)).toBe("acted");
  });
});
