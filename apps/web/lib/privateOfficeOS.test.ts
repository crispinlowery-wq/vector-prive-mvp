import { describe, expect, it } from "vitest";
import { evaluateAuthority, type DelegateMandate } from "./privateOfficeOS";

const mandate: DelegateMandate = {
  id: "m", principal: "A", delegate: "B", role: "PA", status: "active", startsAt: "2026-01-01", expiresAt: "2027-01-01",
  spendingLimit: 5000, scopes: ["Flights", "Hotels"], approvalRules: [], visibleData: [], restrictedData: [],
};

describe("deterministic delegate authority", () => {
  it("allows an in-scope refundable commitment below the limit", () => {
    expect(evaluateAuthority(mandate, "Hotels", 4000)).toEqual({ allowed: true, reason: "Within scope and spending authority" });
  });

  it("requires principal authority above the limit or when non-refundable", () => {
    expect(evaluateAuthority(mandate, "Hotels", 6000).allowed).toBe(false);
    expect(evaluateAuthority(mandate, "Flights", 1000, true).allowed).toBe(false);
  });
});
