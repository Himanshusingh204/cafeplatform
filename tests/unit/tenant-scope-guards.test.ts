import { describe, expect, it } from "vitest";
import { db } from "@/lib/db/prisma";
import { createApiKey, verifyS2SRequest } from "@/lib/auth/s2s";
import { listOrdersAdmin, updateOrderStatus } from "@/lib/services/orders";
import { uniqueSuffix } from "../helpers/db";

async function makeTenant() {
  return db.tenant.create({ data: { slug: `scope-${uniqueSuffix()}`, name: "Scope Test", plan: "PRO" } });
}

async function makeOrder(tenantId: string) {
  return db.order.create({
    data: {
      tenantId,
      orderNumber: `T-${uniqueSuffix()}`,
      customerName: "Test",
      customerEmail: `t-${uniqueSuffix()}@example.com`,
      customerPhone: "9999999999",
      subtotal: 100,
      tax: 5,
      total: 105,
      pickupTime: "ASAP",
    },
  });
}

describe("API key IP allowlist", () => {
  it("rejects a caller whose forwarded address is not listed, accepts a listed one", async () => {
    const tenant = await makeTenant();
    const { apiKey } = await createApiKey({
      tenantId: tenant.id,
      name: "Allowlisted",
      scopes: ["orders:read"],
      ipAllowlist: ["203.0.113.7"],
    });
    const call = (ip?: string) =>
      verifyS2SRequest(
        new Request("http://localhost/x", {
          headers: { authorization: `Bearer ${apiKey}`, ...(ip ? { "x-forwarded-for": ip } : {}) },
        }),
        "orders:read"
      );

    expect(await call("198.51.100.9")).toMatchObject({ success: false, status: 403 });
    expect(await call()).toMatchObject({ success: false, status: 403 });
    expect((await call("203.0.113.7, 10.0.0.1")).success).toBe(true);
  });
});

describe("tenant-scoped order access", () => {
  it("refuses to update another tenant's order", async () => {
    const [a, b] = await Promise.all([makeTenant(), makeTenant()]);
    const order = await makeOrder(a.id);
    await expect(updateOrderStatus(order.id, "CONFIRMED", undefined, b.id)).rejects.toThrow();
    const unchanged = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(unchanged.orderStatus).toBe(order.orderStatus);
  });

  it("lists only the given tenant's orders", async () => {
    const [a, b] = await Promise.all([makeTenant(), makeTenant()]);
    const mine = await makeOrder(a.id);
    await makeOrder(b.id);
    const res = await listOrdersAdmin({ tenantId: a.id });
    expect(res.items.map((o: { id: string }) => o.id)).toEqual([mine.id]);
  });
});
