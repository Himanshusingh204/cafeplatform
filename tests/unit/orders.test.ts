import { describe, it, expect } from "vitest";

import { generateOrderNumber } from "@/lib/services/orders";
import { loyaltyDiscountMinorUnits, resolveTaxRatePercent } from "@/config/pricing";
import { toMajorUnits } from "@/lib/money";

describe("Orders Service Unit Tests", () => {
  it("generates a human-readable ORD-YYMMDD-XXXXXX order number", () => {
    // Base32 without I, L, O, U so the code can be read aloud unambiguously.
    const pattern = /^ORD-\d{6}-[0-9A-HJKMNP-TV-Z]{6}$/;
    expect(generateOrderNumber()).toMatch(pattern);
    expect(generateOrderNumber()).toMatch(pattern);
  });

  it("does not collide across many generations", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) {
      seen.add(generateOrderNumber());
    }
    // 32^6 ≈ 1.07e9 suffixes per day; 2000 draws must all be distinct.
    expect(seen.size).toBe(2000);
  });
});

describe("Pricing configuration (P1-7)", () => {
  it("exposes the tax rate from configuration, not from a literal in the money path", () => {
    expect(resolveTaxRatePercent()).toBe(5);
  });

  it("prefers a tenant rate once one exists (Phase 2 wires the column)", () => {
    expect(resolveTaxRatePercent({ taxRatePercent: 12.5 })).toBe(12.5);
    expect(resolveTaxRatePercent({ taxRatePercent: 0 })).toBe(0);
  });

  it("falls back to the configured default for a missing or unusable tenant rate", () => {
    expect(resolveTaxRatePercent(null)).toBe(5);
    expect(resolveTaxRatePercent({})).toBe(5);
    expect(resolveTaxRatePercent({ taxRatePercent: null })).toBe(5);
    expect(resolveTaxRatePercent({ taxRatePercent: -3 })).toBe(5);
    expect(resolveTaxRatePercent({ taxRatePercent: NaN })).toBe(5);
  });

  it("values loyalty points in whole redemption blocks only", () => {
    // 100 points = ₹50. 150 points is still one block, not one and a half.
    expect(toMajorUnits(loyaltyDiscountMinorUnits(100))).toBe(50);
    expect(toMajorUnits(loyaltyDiscountMinorUnits(150))).toBe(50);
    expect(toMajorUnits(loyaltyDiscountMinorUnits(199))).toBe(50);
    expect(toMajorUnits(loyaltyDiscountMinorUnits(300))).toBe(150);
  });

  it("values nothing below one block, or for nonsense input", () => {
    expect(loyaltyDiscountMinorUnits(99)).toBe(0);
    expect(loyaltyDiscountMinorUnits(0)).toBe(0);
    expect(loyaltyDiscountMinorUnits(-100)).toBe(0);
    expect(loyaltyDiscountMinorUnits(NaN)).toBe(0);
  });
});
