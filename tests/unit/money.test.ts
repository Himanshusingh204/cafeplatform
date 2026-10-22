import { describe, expect, it } from "vitest";

import {
  MoneyError,
  applyRatePercent,
  roundHalfUp,
  toDecimalString,
  toMajorUnits,
  toMinorUnits,
} from "@/lib/money";
import { priceCart, tipFromPercent, toMinorUnitsOrZero } from "@/lib/money/cart";

describe("toMinorUnits", () => {
  it("reads exact decimals from strings, numbers and Decimal-like objects", () => {
    expect(toMinorUnits("123.45")).toBe(12345);
    expect(toMinorUnits(123.45)).toBe(12345);
    expect(toMinorUnits("500")).toBe(50000);
    expect(toMinorUnits(500)).toBe(50000);
    expect(toMinorUnits({ toString: () => "19.99" })).toBe(1999);
    expect(toMinorUnits("0")).toBe(0);
  });

  it("survives the float values that motivated this module", () => {
    // 0.1 + 0.2 is 0.30000000000000004. Parsing it exactly gives 30 paise.
    expect(toMinorUnits(0.1 + 0.2)).toBe(30);
    // 1.005 is really 1.00499999999999989…; the literal's own decimal string is
    // what a human wrote, and half-up gives 101 paise.
    expect(toMinorUnits(1.005)).toBe(101);
  });

  it("rounds half-up at the third decimal", () => {
    expect(toMinorUnits("0.004")).toBe(0);
    expect(toMinorUnits("0.005")).toBe(1);
    expect(toMinorUnits("0.006")).toBe(1);
    expect(toMinorUnits("1.234")).toBe(123);
    expect(toMinorUnits("1.235")).toBe(124);
  });

  it("rounds half away from zero for negatives", () => {
    expect(toMinorUnits("-0.005")).toBe(-1);
    expect(toMinorUnits("-1.235")).toBe(-124);
    expect(toMinorUnits("-12.34")).toBe(-1234);
  });

  it("throws rather than guessing at a non-money value", () => {
    expect(() => toMinorUnits("abc")).toThrow(MoneyError);
    expect(() => toMinorUnits("12.3.4")).toThrow(MoneyError);
    expect(() => toMinorUnits("")).toThrow(MoneyError);
    expect(() => toMinorUnits(NaN)).toThrow(MoneyError);
    expect(() => toMinorUnits(Infinity)).toThrow(MoneyError);
    expect(() => toMinorUnits(1e21)).toThrow(MoneyError);
    expect(() => toMinorUnits(null as unknown as string)).toThrow(MoneyError);
  });
});

describe("toDecimalString", () => {
  it("produces the exact fixed-point a Decimal(10,2) column expects", () => {
    expect(toDecimalString(12345)).toBe("123.45");
    expect(toDecimalString(5)).toBe("0.05");
    expect(toDecimalString(0)).toBe("0.00");
    expect(toDecimalString(100)).toBe("1.00");
    expect(toDecimalString(-1234)).toBe("-12.34");
  });

  it("round-trips with toMinorUnits", () => {
    for (const minorUnits of [0, 1, 99, 100, 12345, 9999999999, -1234]) {
      expect(toMinorUnits(toDecimalString(minorUnits))).toBe(minorUnits);
    }
  });

  it("rejects a non-integer amount", () => {
    expect(() => toDecimalString(1.5)).toThrow(MoneyError);
  });
});

describe("toMajorUnits", () => {
  it("is a presentation conversion, not an arithmetic one", () => {
    expect(toMajorUnits(12345)).toBe(123.45);
    expect(toMajorUnits(5)).toBe(0.05);
    expect(() => toMajorUnits(1.5)).toThrow(MoneyError);
  });
});

describe("roundHalfUp", () => {
  it("rounds half away from zero", () => {
    expect(roundHalfUp(45, 100)).toBe(0);
    expect(roundHalfUp(50, 100)).toBe(1);
    expect(roundHalfUp(49, 100)).toBe(0);
    expect(roundHalfUp(51, 100)).toBe(1);
    expect(roundHalfUp(150, 100)).toBe(2);
    expect(roundHalfUp(250, 100)).toBe(3);
    expect(roundHalfUp(0, 100)).toBe(0);
  });

  it("works for non-decimal denominators", () => {
    expect(roundHalfUp(1, 3)).toBe(0);
    expect(roundHalfUp(2, 3)).toBe(1);
    expect(roundHalfUp(5, 2)).toBe(3);
  });

  it("rejects inputs that would silently lose precision", () => {
    expect(() => roundHalfUp(-1, 100)).toThrow(MoneyError);
    expect(() => roundHalfUp(1, 0)).toThrow(MoneyError);
    expect(() => roundHalfUp(1, -100)).toThrow(MoneyError);
    expect(() => roundHalfUp(1.5, 100)).toThrow(MoneyError);
  });
});

describe("applyRatePercent", () => {
  it("applies whole-percent rates exactly", () => {
    expect(applyRatePercent(100000, 5)).toBe(5000); // ₹1000 → ₹50 tax
    expect(applyRatePercent(90000, 5)).toBe(4500);
    expect(applyRatePercent(0, 5)).toBe(0);
    expect(applyRatePercent(100000, 0)).toBe(0);
    expect(applyRatePercent(100000, 100)).toBe(100000);
  });

  it("never uses the float 0.05 — 5 % is exactly a twentieth", () => {
    // ₹1 at 5 % is 5 paise, not 4.999999999999999 paise.
    expect(applyRatePercent(100, 5)).toBe(5);
    expect(applyRatePercent(1234, 5)).toBe(62); // 61.7 → 62, half-up
    expect(applyRatePercent(1230, 5)).toBe(62); // 61.5 → 62, exactly half
    expect(applyRatePercent(1229, 5)).toBe(61); // 61.45 → 61
  });

  it("supports fractional rates to three decimal places", () => {
    expect(applyRatePercent(100000, 5.5)).toBe(5500);
    expect(applyRatePercent(100000, 5.125)).toBe(5125);
    expect(applyRatePercent(100000, 0.001)).toBe(1);
  });

  it("rejects nonsense rates and out-of-range amounts", () => {
    expect(() => applyRatePercent(100, -5)).toThrow(MoneyError);
    expect(() => applyRatePercent(100, NaN)).toThrow(MoneyError);
    expect(() => applyRatePercent(100, Infinity)).toThrow(MoneyError);
    expect(() => applyRatePercent(-100, 5)).toThrow(MoneyError);
    expect(() => applyRatePercent(1.5, 5)).toThrow(MoneyError);
    expect(() => applyRatePercent(1e15, 100)).toThrow(MoneyError);
  });
});

describe("priceCart — one rule shared by the storefront and the server", () => {
  it("charges the ₹10 order ₹10.50, not ₹11", () => {
    // The checkout page used to compute Math.round(10 * 0.05) = ₹1 of tax, so it
    // displayed ₹11 while the API charged ₹10.50. Both now call priceCart.
    const cart = priceCart({ subtotalMinorUnits: 1000, taxRatePercent: 5 });

    expect(cart.taxMinorUnits).toBe(50);
    expect(toDecimalString(cart.taxMinorUnits)).toBe("0.50");
    expect(toDecimalString(cart.totalMinorUnits)).toBe("10.50");
  });

  it("never charges tax on the tip", () => {
    const withTip = priceCart({ subtotalMinorUnits: 100000, tipMinorUnits: 10000, taxRatePercent: 5 });
    const withoutTip = priceCart({ subtotalMinorUnits: 100000, taxRatePercent: 5 });

    expect(withTip.taxMinorUnits).toBe(withoutTip.taxMinorUnits);
    expect(withTip.totalMinorUnits - withoutTip.totalMinorUnits).toBe(10000);
  });

  it("applies the coupon and loyalty discounts before tax", () => {
    const cart = priceCart({
      subtotalMinorUnits: 104900,
      couponDiscountMinorUnits: 10490,
      loyaltyDiscountMinorUnits: 5000,
      taxRatePercent: 5,
    });

    expect(cart.discountMinorUnits).toBe(15490);
    expect(cart.taxableMinorUnits).toBe(89410);
    expect(cart.taxMinorUnits).toBe(4471); // 4470.5 → 4471, half-up
    expect(cart.totalMinorUnits).toBe(93881);
  });

  it("caps the discount at the subtotal so a total can never go negative", () => {
    const cart = priceCart({
      subtotalMinorUnits: 50000,
      couponDiscountMinorUnits: 50000,
      loyaltyDiscountMinorUnits: 50000,
      taxRatePercent: 5,
    });

    expect(cart.discountMinorUnits).toBe(50000);
    expect(cart.taxableMinorUnits).toBe(0);
    expect(cart.taxMinorUnits).toBe(0);
    expect(cart.totalMinorUnits).toBe(0);
  });

  it("ignores nonsense discounts and tips rather than producing NaN", () => {
    const cart = priceCart({
      subtotalMinorUnits: 10000,
      couponDiscountMinorUnits: Number.NaN,
      loyaltyDiscountMinorUnits: -500,
      tipMinorUnits: Number.POSITIVE_INFINITY,
      taxRatePercent: 5,
    });

    expect(cart.discountMinorUnits).toBe(0);
    expect(cart.tipMinorUnits).toBe(0);
    expect(cart.totalMinorUnits).toBe(10500);
  });
});

describe("tipFromPercent", () => {
  it("is the same percentage rule the server applies to a rate", () => {
    // 15 % of ₹250 is ₹37.50, not ₹38.
    expect(toDecimalString(tipFromPercent(25000, 15))).toBe("37.50");
    expect(toDecimalString(tipFromPercent(19900, 10))).toBe("19.90");
    expect(tipFromPercent(0, 15)).toBe(0);
  });
});

describe("toMinorUnitsOrZero", () => {
  it("treats a half-typed or unreadable field as zero instead of throwing", () => {
    expect(toMinorUnitsOrZero("")).toBe(0);
    expect(toMinorUnitsOrZero("abc")).toBe(0);
    expect(toMinorUnitsOrZero(undefined)).toBe(0);
    expect(toMinorUnitsOrZero("-5")).toBe(0);
    expect(toMinorUnitsOrZero("42.75")).toBe(4275);
  });
});

describe("the invariants the order path depends on", () => {
  it("keeps the stored total equal to the sum of its parts", () => {
    const subtotal = toMinorUnits("1049.00");
    const discount = applyRatePercent(subtotal, 10); // ₹104.90
    const taxable = subtotal - discount;
    const tax = applyRatePercent(taxable, 5);
    const tip = toMinorUnits("51.50");
    const total = taxable + tax + tip;

    expect(discount).toBe(10490);
    expect(taxable).toBe(94410);
    expect(tax).toBe(4721); // 4720.5 → 4721
    expect(tip).toBe(5150);
    expect(total).toBe(104281);

    // Re-deriving from the stored strings reproduces the same total exactly.
    expect(
      toMinorUnits(toDecimalString(taxable)) +
        toMinorUnits(toDecimalString(tax)) +
        toMinorUnits(toDecimalString(tip))
    ).toBe(toMinorUnits(toDecimalString(total)));
  });

  it("charges no tax on a fully discounted order", () => {
    const subtotal = toMinorUnits("500.00");
    const discount = applyRatePercent(subtotal, 100);
    const taxable = Math.max(0, subtotal - discount);

    expect(discount).toBe(subtotal);
    expect(applyRatePercent(taxable, 5)).toBe(0);
  });
});
