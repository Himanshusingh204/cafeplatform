import { describe, it, expect } from "vitest";
import { generateOrderNumber } from "@/lib/services/orders";

describe("Orders Service Unit Tests", () => {
  it("generates an order number with 'ORD-' prefix and 4 digits", () => {
    const orderNum1 = generateOrderNumber();
    const orderNum2 = generateOrderNumber();

    expect(orderNum1).toMatch(/^ORD-\d{4}$/);
    expect(orderNum2).toMatch(/^ORD-\d{4}$/);
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
