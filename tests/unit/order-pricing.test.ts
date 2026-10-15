import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getOrCreateDefaultTenant } from "@/lib/db/tenant";
import { createDish } from "@/lib/services/menu";
import { createOrder, OrderValidationError } from "@/lib/services/orders";
import { dishInput, makeCategory, truncateTables, uniqueSuffix } from "../helpers/db";

const TABLES = ["LoyaltyLedger", "OrderItem", "Order", "CustomerUser"] as const;

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

  it("rejects a non-positive price for an ad-hoc item with no dishId", async () => {
    const suffix = uniqueSuffix();

    await expect(
      createOrder({
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
