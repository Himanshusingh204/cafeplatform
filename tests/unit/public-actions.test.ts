import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server actions call Next's cache revalidation, which has no request store in
// a unit test. The security assertions below are about the database, not cache.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));

import { submitReservationAction, submitTakeawayOrderAction } from "@/lib/actions/public";
import { db } from "@/lib/db/prisma";
import { getOrCreateDefaultTenant } from "@/lib/db/tenant";
import { createDish } from "@/lib/services/menu";
import type { CreateReservationInput } from "@/lib/services/reservations";
import { dishInput, makeCategory, truncateTables, uniqueSuffix } from "../helpers/db";

const TABLES = ["OrderItem", "Order", "Dish", "Category"] as const;

beforeAll(async () => {
  await truncateTables(...TABLES);
});

afterAll(async () => {
  await truncateTables(...TABLES);
});

describe("submitTakeawayOrderAction — public trust boundary (P0)", () => {
  it("ignores a forged paymentStatus and tenantId from the browser", async () => {
    const suffix = uniqueSuffix();
    const tenant = await getOrCreateDefaultTenant();
    const category = await makeCategory();
    const dish = await createDish(
      dishInput(category.id, { name: `Action Dish ${suffix}`, price: 350 })
    );

    const result = await submitTakeawayOrderAction({
      // Attack surface: a browser can put anything on the wire.
      tenantId: "11111111-1111-4111-8111-111111111111",
      paymentStatus: "PAID",
      customerName: "Action Tester",
      customerEmail: `action-${suffix}@example.com`,
      customerPhone: "+91 90000 00012",
      items: [{ dishId: dish.id, dishName: dish.name, quantity: 1, price: 1 }],
    });

    expect(result.ok).toBe(true);
    const order = await db.order.findUnique({
      where: { id: result.data?.id },
    });

    // The server chose the tenant and the payment state.
    expect(order?.tenantId).toBe(tenant.id);
    expect(order?.paymentStatus).toBe("PAY_AT_PICKUP");
    expect(Number(order?.total)).toBe(367.5);
  });
});

describe("submitReservationAction — date validation (P2)", () => {
  const base = (email: string) => ({
    name: "Date Tester",
    email,
    phone: "+91 90000 00013",
    guests: 2,
    timeSlot: "19:30",
  });

  it("rejects a date that is not YYYY-MM-DD", async () => {
    const result = await submitReservationAction({
      ...base(`baddate-${uniqueSuffix()}@example.com`),
      date: "next friday" as unknown as Date,
    } as CreateReservationInput);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid booking date/i);
  });

  it("rejects a past calendar date", async () => {
    const result = await submitReservationAction({
      ...base(`pastdate-${uniqueSuffix()}@example.com`),
      date: "2000-01-01" as unknown as Date,
    } as CreateReservationInput);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/future date/i);
  });

  it("rejects an impossible calendar date such as 2026-02-31", async () => {
    const result = await submitReservationAction({
      ...base(`impossible-${uniqueSuffix()}@example.com`),
      date: "2026-02-31" as unknown as Date,
    } as CreateReservationInput);

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid booking date/i);
  });
});
