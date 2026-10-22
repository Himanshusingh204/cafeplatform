import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db/prisma";
import { getOrCreateDefaultTenant } from "@/lib/db/tenant";
import { toDecimalString, toMinorUnits } from "@/lib/money";
import { createDish } from "@/lib/services/menu";
import { createOrder, OrderValidationError, publicOrderInputSchema } from "@/lib/services/orders";
import { dishInput, makeCategory, testTenantId, truncateTables, uniqueSuffix } from "../helpers/db";

const TABLES = ["LoyaltyLedger", "OrderItem", "Order", "CustomerUser"] as const;

/** Prisma returns a Decimal; this renders it as the exact fixed-point string. */
function toDecimalStringOf(value: { toString(): string }): string {
  return toDecimalString(toMinorUnits(value));
}

beforeAll(async () => {
  await truncateTables(...TABLES);
});

afterAll(async () => {
  await truncateTables(...TABLES);
});

describe("createOrder — authoritative server-side pricing (P0-1)", () => {
  it("ignores a client-supplied price and uses the catalog price", async () => {
    const suffix = uniqueSuffix();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Tamper Target ${suffix}`, price: 500 })
    );

    const order = await createOrder({
      customerName: "Tamper Tester",
      customerEmail: `tamper-${suffix}@example.com`,
      customerPhone: "+91 90000 00000",
      // Attacker claims the ₹500 dish costs ₹1.
      items: [{ dishId: dish.id, dishName: dish.name, quantity: 1, price: 1 }],
    });

    expect(order.items).toHaveLength(1);
    expect(Number(order.items[0].price)).toBe(500);
    expect(Number(order.subtotal)).toBe(500);
  });

  it("rejects a dish that is marked out of stock", async () => {
    const suffix = uniqueSuffix();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Sold Out ${suffix}`, price: 300, isAvailable: false })
    );

    await expect(
      createOrder({
        customerName: "Sold Out Tester",
        customerEmail: `soldout-${suffix}@example.com`,
        customerPhone: "+91 90000 00001",
        items: [{ dishId: dish.id, dishName: dish.name, quantity: 1 }],
      })
    ).rejects.toBeInstanceOf(OrderValidationError);
  });

  it("rejects an ad-hoc item with no dishId unless a trusted caller opts in", async () => {
    const suffix = uniqueSuffix();

    await expect(
      createOrder({
        customerName: "Ad Hoc Tester",
        customerEmail: `adhoc-${suffix}@example.com`,
        customerPhone: "+91 90000 00002",
        items: [{ dishName: "Ghost Item", quantity: 1, price: 500 }],
      })
    ).rejects.toBeInstanceOf(OrderValidationError);
  });

  it("still rejects a non-positive price for a trusted ad-hoc item", async () => {
    const suffix = uniqueSuffix();

    await expect(
      createOrder({
        allowAdHoc: true,
        customerName: "Ad Hoc Tester",
        customerEmail: `adhoc-${suffix}@example.com`,
        customerPhone: "+91 90000 00002",
        items: [{ dishName: "Ghost Item", quantity: 1, price: 0 }],
      })
    ).rejects.toBeInstanceOf(OrderValidationError);
  });

  it("assigns the supplied tenant to the created order", async () => {
    const suffix = uniqueSuffix();
    const tenant = await getOrCreateDefaultTenant();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Tenant Scoped ${suffix}`, price: 250 })
    );

    const order = await createOrder({
      tenantId: tenant.id,
      customerName: "Tenant Tester",
      customerEmail: `tenant-${suffix}@example.com`,
      customerPhone: "+91 90000 00003",
      items: [{ dishId: dish.id, dishName: dish.name, quantity: 1 }],
    });

    expect(order.tenantId).toBe(tenant.id);
  });
});

describe("createOrder — money is exact and tax is configured (P1-7)", () => {
  it("charges tax in paise, not rounded up to whole rupees", async () => {
    const suffix = uniqueSuffix();
    const category = await makeCategory();
    // ₹10 at 5 % is ₹0.50. The float path used Math.round(10 * 0.05) and stored
    // ₹1; the exact path stores 50 paise.
    const dish = await createDish(
      dishInput(category.id, { name: `Small Ticket ${suffix}`, price: 10 })
    );

    const order = await createOrder({
      customerName: "Penny Tester",
      customerEmail: `penny-${suffix}@example.com`,
      customerPhone: "+91 90000 00004",
      items: [{ dishId: dish.id, dishName: dish.name, quantity: 1 }],
    });

    expect(toDecimalStringOf(order.subtotal)).toBe("10.00");
    expect(toDecimalStringOf(order.tax)).toBe("0.50");
    expect(toDecimalStringOf(order.total)).toBe("10.50");
  });

  it("adds tax, discount and tip so that the stored total equals the sum of its parts", async () => {
    const suffix = uniqueSuffix();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Exact Parts ${suffix}`, price: 1049 })
    );

    const coupon = await db.coupon.create({
      data: { tenantId: await testTenantId(), code: `TEN-${suffix}`.toUpperCase(), discountPercent: 10, isActive: true },
    });

    const order = await createOrder({
      customerName: "Exact Tester",
      customerEmail: `exact-${suffix}@example.com`,
      customerPhone: "+91 90000 00005",
      tip: 51.5,
      couponCode: coupon.code,
      items: [{ dishId: dish.id, dishName: dish.name, quantity: 1 }],
    });

    // ₹1049 − 10 % = ₹944.10 taxable; 5 % of that is ₹47.205 → 4721 paise.
    expect(toDecimalStringOf(order.subtotal)).toBe("1049.00");
    expect(toDecimalStringOf(order.discount)).toBe("104.90");
    expect(toDecimalStringOf(order.tax)).toBe("47.21");
    expect(toDecimalStringOf(order.tip)).toBe("51.50");
    expect(toDecimalStringOf(order.total)).toBe("1042.81");

    // The invariant: total === (subtotal − discount) + tax + tip, exactly.
    const parts = toMinorUnits(order.subtotal) - toMinorUnits(order.discount);
    expect(toMinorUnits(order.total)).toBe(
      parts + toMinorUnits(order.tax) + toMinorUnits(order.tip)
    );
  });

  it("charges no tax when the discount covers the whole order", async () => {
    const suffix = uniqueSuffix();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Free Lunch ${suffix}`, price: 500 })
    );

    const coupon = await db.coupon.create({
      data: { tenantId: await testTenantId(), code: `FULL-${suffix}`.toUpperCase(), discountPercent: 100, isActive: true },
    });

    const order = await createOrder({
      customerName: "Free Tester",
      customerEmail: `free-${suffix}@example.com`,
      customerPhone: "+91 90000 00006",
      couponCode: coupon.code,
      items: [{ dishId: dish.id, dishName: dish.name, quantity: 1 }],
    });

    expect(toDecimalStringOf(order.subtotal)).toBe("500.00");
    expect(toDecimalStringOf(order.discount)).toBe("500.00");
    expect(toDecimalStringOf(order.tax)).toBe("0.00");
    expect(toDecimalStringOf(order.total)).toBe("0.00");
  });

  it("uses the catalog modifier delta and ignores a forged client delta", async () => {
    const suffix = uniqueSuffix();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Modifier Math ${suffix}`, price: 200 })
    );

    const group = await db.dishModifierGroup.create({
      data: { dishId: dish.id, name: "Extras", minSelect: 0, maxSelect: 2 },
    });
    const option = await db.dishModifierOption.create({
      data: { groupId: group.id, name: "Extra Paneer", priceDelta: "60.50" },
    });

    const order = await createOrder({
      customerName: "Modifier Tester",
      customerEmail: `mod-${suffix}@example.com`,
      customerPhone: "+91 90000 00007",
      items: [
        {
          dishId: dish.id,
          dishName: dish.name,
          quantity: 1,
          modifiers: [
            // Attacker claims the ₹60.50 extra costs nothing.
            { groupName: "Extras", optionName: "Extra Paneer", priceDelta: 0 },
            // The id path is preferred and is equally authoritative.
            { optionId: option.id, priceDelta: -9999 },
          ],
        },
      ],
    });

    // ₹200 + ₹60.50 + ₹60.50 = ₹321.00; forged deltas contribute nothing.
    expect(toDecimalStringOf(order.subtotal)).toBe("321.00");
    expect(toDecimalStringOf(order.items[0].price)).toBe("321.00");
    expect(toDecimalStringOf(order.items[0].modifiers[0].priceDelta)).toBe("60.50");
    expect(toDecimalStringOf(order.items[0].modifiers[1].priceDelta)).toBe("60.50");
  });

  it("rejects a modifier that is not sold on the ordered dish", async () => {
    const suffix = uniqueSuffix();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `No Modifiers ${suffix}`, price: 200 })
    );

    await expect(
      createOrder({
        customerName: "Modifier Tester",
        customerEmail: `nomod-${suffix}@example.com`,
        customerPhone: "+91 90000 00007",
        items: [
          {
            dishId: dish.id,
            dishName: dish.name,
            quantity: 1,
            modifiers: [{ groupName: "Extras", optionName: "Free Gold", priceDelta: -500 }],
          },
        ],
      })
    ).rejects.toBeInstanceOf(OrderValidationError);
  });

  it("rejects a tip that is not a money value instead of storing NaN", async () => {
    const suffix = uniqueSuffix();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Bad Tip ${suffix}`, price: 100 })
    );

    await expect(
      createOrder({
        customerName: "Bad Tip Tester",
        customerEmail: `badtip-${suffix}@example.com`,
        customerPhone: "+91 90000 00008",
        tip: Number.POSITIVE_INFINITY,
        items: [{ dishId: dish.id, dishName: dish.name, quantity: 1 }],
      })
    ).rejects.toBeInstanceOf(OrderValidationError);
  });
});

describe("public order input — trusted fields cannot be forged (P0)", () => {
  const publicPayload = () => ({
    customerName: "Public Tester",
    customerEmail: `public-${uniqueSuffix()}@example.com`,
    customerPhone: "+91 90000 00009",
    items: [
      {
        dishId: randomUUID(),
        dishName: "Some Dish",
        quantity: 1,
        price: 1,
        modifiers: [{ groupName: "Extras", optionName: "Cheese", priceDelta: 0 }],
      },
    ],
  });

  it("strips paymentStatus, tenantId and every client-supplied total", () => {
    const parsed = publicOrderInputSchema.parse({
      ...publicPayload(),
      paymentStatus: "PAID",
      tenantId: randomUUID(),
      total: 1,
      subtotal: 1,
      tax: 0,
      discount: 0,
      loyaltyPointsUsed: 9999,
    });

    expect(parsed).not.toHaveProperty("paymentStatus");
    expect(parsed).not.toHaveProperty("tenantId");
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("subtotal");
    expect(parsed).not.toHaveProperty("tax");
    expect(parsed).not.toHaveProperty("discount");
    expect(parsed).not.toHaveProperty("loyaltyPointsUsed");
  });

  it("refuses an ad-hoc line with no dishId from the public schema", () => {
    const result = publicOrderInputSchema.safeParse({
      ...publicPayload(),
      items: [{ dishName: "Ghost Item", quantity: 1, price: 1 }],
    });

    expect(result.success).toBe(false);
  });

  it("prices a stripped payload normally and leaves payment at PAY_AT_PICKUP", async () => {
    const suffix = uniqueSuffix();
    const tenant = await getOrCreateDefaultTenant();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Public Dish ${suffix}`, price: 400 })
    );

    const parsed = publicOrderInputSchema.parse({
      ...publicPayload(),
      tenantId: "11111111-1111-4111-8111-111111111111",
      paymentStatus: "PAID",
      items: [{ dishId: dish.id, dishName: dish.name, quantity: 1, price: 1 }],
    });

    const order = await createOrder({
      ...parsed,
      tenantId: tenant.id,
      allowAdHoc: false,
    });

    expect(order.tenantId).toBe(tenant.id);
    expect(order.paymentStatus).toBe("PAY_AT_PICKUP");
    expect(Number(order.subtotal)).toBe(400);
  });
});

describe("loyalty redemption is atomic (P1)", () => {
  it("cannot spend the same points on two concurrent orders", async () => {
    const suffix = uniqueSuffix();
    const tenant = await getOrCreateDefaultTenant();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Atomic Loyalty ${suffix}`, price: 500 })
    );

    const customer = await db.customerUser.create({
      data: {
        tenantId: tenant.id,
        name: "Atomic Tester",
        email: `atomic-${suffix}@example.com`,
        phone: "+91 90000 00010",
        loyaltyPoints: 100,
        lifetimeSpend: "0",
      },
    });

    const input = {
      tenantId: tenant.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerPhone: customer.phone ?? "+91 90000 00010",
      loyaltyPointsToRedeem: 100,
      items: [{ dishId: dish.id, dishName: dish.name, quantity: 1 }],
    };

    await Promise.allSettled([createOrder(input), createOrder(input)]);

    const redemptions = await db.loyaltyLedger.count({
      where: { customerId: customer.id, pointsDelta: { lt: 0 } },
    });
    const discountedOrders = await db.order.count({
      where: { customerEmail: customer.email, loyaltyPointsUsed: 100 },
    });

    expect(redemptions).toBe(1);
    expect(discountedOrders).toBe(1);
  });
});
