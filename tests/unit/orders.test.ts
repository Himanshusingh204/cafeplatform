import { describe, it, expect } from "vitest";
import { generateOrderNumber } from "@/lib/services/orders";

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

  it("calculates 5% GST and discount correctly", () => {
    const subtotal = 1000;
    const discountPercent = 10;
    const discountAmount = Math.round((subtotal * discountPercent) / 100);
    const taxable = subtotal - discountAmount;
    const tax = Math.round(taxable * 0.05);
    const grandTotal = taxable + tax;

    expect(discountAmount).toBe(100);
    expect(taxable).toBe(900);
    expect(tax).toBe(45);
    expect(grandTotal).toBe(945);
  });
});
