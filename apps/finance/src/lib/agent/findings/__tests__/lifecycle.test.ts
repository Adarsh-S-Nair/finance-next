import { decideStatus, selectStaleKeys } from "../lifecycle";

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

  it("brings a resolved finding back as new when it fires again, no gate", () => {
    // The situation cleared, then recurred — even smaller than before it
    // surfaces, because the user never dismissed it.
    expect(decideStatus({ status: "resolved", value_annual: 400 }, 50)).toBe("new");
    expect(decideStatus({ status: "resolved", value_annual: null }, null)).toBe("new");
  });
});

describe("selectStaleKeys", () => {
  const detected = new Set(["idle_cash:a1", "bank_fees:a2"]);

  it("resolves an active finding no longer detected this sweep", () => {
    // idle_cash:a1 fired again, but the bank-fees flag did not → only the
    // latter is stale.
    expect(
      selectStaleKeys(
        [
          { dedupe_key: "idle_cash:a1", status: "new" },
          { dedupe_key: "bank_fees:a2", status: "seen" },
          { dedupe_key: "cc_interest:a3", status: "seen" },
        ],
        detected,
      ),
    ).toEqual(["cc_interest:a3"]);
  });

  it("never touches terminal or already-resolved states", () => {
    expect(
      selectStaleKeys(
        [
          { dedupe_key: "x1", status: "dismissed" },
          { dedupe_key: "x2", status: "acted" },
          { dedupe_key: "x3", status: "resolved" },
        ],
        new Set<string>(),
      ),
    ).toEqual([]);
  });

  it("returns nothing when every active finding still fires", () => {
    expect(
      selectStaleKeys(
        [
          { dedupe_key: "idle_cash:a1", status: "new" },
          { dedupe_key: "bank_fees:a2", status: "seen" },
        ],
        detected,
      ),
    ).toEqual([]);
  });
});
