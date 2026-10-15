import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/prisma";
import {
  calculateTier,
  calculatePointsEarned,
  findOrCreateCustomer,
  redeemPoints,
  getCustomerLoyaltyProfile,
} from "@/lib/services/loyalty";
import { createOrder } from "@/lib/services/orders";
import { createDish } from "@/lib/services/menu";
import { dishInput, makeCategory, truncateTables, uniqueSuffix } from "../helpers/db";

beforeAll(async () => {
  await truncateTables("LoyaltyLedger", "OrderItem", "Order", "CustomerUser");
});

afterAll(async () => {
  await truncateTables("LoyaltyLedger", "OrderItem", "Order", "CustomerUser");
});

describe("Customer VIP Loyalty & 1-Click Reorder Engine", () => {
  it("calculates loyalty tiers based on lifetime spend thresholds", () => {
    expect(calculateTier(0)).toBe("BRONZE");
    expect(calculateTier(4999)).toBe("BRONZE");
    expect(calculateTier(5000)).toBe("SILVER");
    expect(calculateTier(14999)).toBe("SILVER");
    expect(calculateTier(15000)).toBe("GOLD");
    expect(calculateTier(29999)).toBe("GOLD");
    expect(calculateTier(30000)).toBe("PLATINUM");
    expect(calculateTier(50000)).toBe("PLATINUM");
  });

  it("calculates points earned with tier multipliers", () => {
    // 10 pts per ₹100 spent base (10%)
    // Bronze: 1x -> ₹1,000 spent = 100 points
    expect(calculatePointsEarned(1000, "BRONZE")).toBe(100);

    // Silver: 1.25x -> ₹1,000 spent = 125 points
    expect(calculatePointsEarned(1000, "SILVER")).toBe(125);

    // Gold: 1.5x -> ₹1,000 spent = 150 points
    expect(calculatePointsEarned(1000, "GOLD")).toBe(150);

    // Platinum: 2x -> ₹1,000 spent = 200 points
    expect(calculatePointsEarned(1000, "PLATINUM")).toBe(200);
  });

  it("processes loyalty rewards on order creation and logs points ledger", async () => {
    const suffix = uniqueSuffix();
    const email = `vip-${suffix}@example.com`;

    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Royal Thali ${suffix}`, price: 1000 })
    );

    await createOrder({
      customerName: "Aarav Mehta",
      customerEmail: email,
      customerPhone: "+91 99999 88888",
      items: [
        {
          dishId: dish.id,
          dishName: dish.name,
          quantity: 2, // Subtotal ₹2000
          price: 1000,
        },
      ],
    });

    const customer = await db.customerUser.findUnique({
      where: { email },
      include: { ledgerEntries: true },
    });

    expect(customer).toBeDefined();
    // ₹2000 subtotal at Bronze (10 pts / 100) = 200 points
    expect(customer?.loyaltyPoints).toBe(200);
    expect(Number(customer?.lifetimeSpend)).toBe(2000);
    expect(customer?.ledgerEntries.length).toBeGreaterThan(0);
    expect(customer?.ledgerEntries[0].pointsDelta).toBe(200);

    // Profile query with 1-click reorder past orders
    const profile = await getCustomerLoyaltyProfile(email);
    expect(profile?.loyaltyPoints).toBe(200);
    expect(profile?.recentOrders.length).toBeGreaterThan(0);
    expect(profile?.recentOrders[0].items[0].dishName).toBe(dish.name);
  });

  it("redeems points for discounts and records redemption ledger", async () => {
    const suffix = uniqueSuffix();
    const email = `redeem-${suffix}@example.com`;

    const customer = await findOrCreateCustomer({
      email,
      name: "Deepika Padukone",
    });

    // Manually set initial balance
    await db.customerUser.update({
      where: { id: customer.id },
      data: { loyaltyPoints: 350 },
    });

    // Redeem 200 points (200 pts = ₹100 discount)
    const result = await redeemPoints(customer.id, 200);
    expect(result.remainingPoints).toBe(150);
    expect(result.discountAmount).toBe(100);

    const updated = await db.customerUser.findUnique({
      where: { id: customer.id },
    });
    expect(updated?.loyaltyPoints).toBe(150);

    const ledger = await db.loyaltyLedger.findFirst({
      where: { customerId: customer.id, pointsDelta: -200 },
    });
    expect(ledger).toBeDefined();
    expect(ledger?.reason).toContain("Redeemed 200 points");
  });
});
