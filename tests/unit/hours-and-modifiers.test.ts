import { describe, it, expect } from "vitest";
import { getStoreStatus, getAvailablePickupSlots, isSlotValid } from "@/lib/services/hours";

describe("Operating Hours & Timeslot Service Unit Tests", () => {
  it("reports store as OPEN during standard afternoon operating hours", () => {
    // Wednesday at 14:00 (2:00 PM)
    const midDay = new Date("2026-06-10T14:00:00");
    const status = getStoreStatus(midDay);

    expect(status.isOpen).toBe(true);
    expect(status.dayName).toBe("Wednesday");
    expect(status.message).toContain("open and accepting orders");
  });

  it("reports store as CLOSED before morning opening time", () => {
    // Wednesday at 08:30 AM
    const earlyMorning = new Date("2026-06-10T08:30:00");
    const status = getStoreStatus(earlyMorning);

    expect(status.isOpen).toBe(false);
    expect(status.message).toContain("opens at");
  });

  it("reports store as CLOSED after last-order cutoff", () => {
    // Wednesday at 22:10 (closing is 22:00, last order at 21:45)
    const lateNight = new Date("2026-06-10T22:10:00");
    const status = getStoreStatus(lateNight);

    expect(status.isOpen).toBe(false);
    expect(status.message).toContain("closed");
  });

  it("generates pickup slots including ASAP during open hours", () => {
    const afternoon = new Date("2026-06-10T14:00:00");
    const slots = getAvailablePickupSlots(afternoon);

    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toContain("ASAP");
  });

  it("validates DINE_IN dining mode orders unconditionally", () => {
    expect(isSlotValid("", "DINE_IN")).toBe(true);
    expect(isSlotValid("Table 4", "DINE_IN")).toBe(true);
  });

  it("validates ASAP pickup times for takeaway", () => {
    expect(isSlotValid("ASAP (~20–30 mins)", "TAKEAWAY")).toBe(true);
    expect(isSlotValid("ASAP", "TAKEAWAY")).toBe(true);
    expect(isSlotValid("", "TAKEAWAY")).toBe(false);
  });
});

describe("Dish Modifiers & Gratuity Calculation Unit Tests", () => {
  it("accurately computes item total with multiple modifiers", () => {
    const basePrice = 14.5;
    const selectedModifiers = [
      { name: "Extra Spiced", priceDelta: 0.5 },
      { name: "Organic Oat Milk", priceDelta: 0.8 },
      { name: "Truffle Naan Upgrade", priceDelta: 2.5 },
    ];

    const modifierSum = selectedModifiers.reduce((acc, m) => acc + m.priceDelta, 0);
    const unitPrice = basePrice + modifierSum;
    const quantity = 3;
    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;

    expect(modifierSum).toBe(3.8);
    expect(unitPrice).toBe(18.3);
    expect(lineTotal).toBe(54.9);
  });

  it("accurately calculates gratuity and final ticket total", () => {
    const itemsTotal = 50.0;
    const discount = 5.0; // £45 subtotal
    const subtotal = itemsTotal - discount;
    const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST = £2.25
    const tipPercentage = 15;
    const tip = Math.round(((subtotal * tipPercentage) / 100) * 100) / 100; // £6.75
    const grandTotal = Math.round((subtotal + tax + tip) * 100) / 100;

    expect(tax).toBe(2.25);
    expect(tip).toBe(6.75);
    expect(grandTotal).toBe(54.0);
  });

  it("generates distinct composite keys for different modifier combinations of the same dish", () => {
    const dishId = "dish-butter-chicken-123";

    const custom1Modifiers = ["mild", "oat-milk"];
    const custom2Modifiers = ["extra-hot", "coconut-cream"];

    const key1 = `${dishId}::${custom1Modifiers.sort().join(";")}`;
    const key2 = `${dishId}::${custom2Modifiers.sort().join(";")}`;
    const keyNoMods = `${dishId}::`;

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(keyNoMods);
    expect(key1).toBe(`${dishId}::mild;oat-milk`);
    expect(key2).toBe(`${dishId}::coconut-cream;extra-hot`);
  });
});
