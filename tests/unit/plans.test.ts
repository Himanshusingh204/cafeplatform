import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { db } from "@/lib/db/prisma";
import { createApiKey } from "@/lib/auth/s2s";
import {
  PLAN_LIMITS,
  PlanLimitError,
  assertWithinPlan,
  getPlanUsage,
  type PlanResource,
} from "@/lib/plans";
import { createDish } from "@/lib/services/menu";
import { createGalleryImage } from "@/lib/services/gallery";
import { createOrder } from "@/lib/services/orders";
import { dishInput, uniqueSuffix } from "../helpers/db";

type MutableLimits = Record<PlanResource, number>;
const free = PLAN_LIMITS.FREE as MutableLimits;
const original = { ...free };

afterEach(() => {
  Object.assign(free, original);
});

async function freeTenant() {
  return db.tenant.create({
    data: { slug: `plan-${uniqueSuffix()}`, name: "Plan Tenant", plan: "FREE" },
  });
}

let categoryOf: (tenantId: string) => Promise<string>;

beforeAll(() => {
  categoryOf = async (tenantId) =>
    (
      await db.category.create({
        data: { tenantId, name: "Plan Cat", slug: `plan-cat-${uniqueSuffix()}` },
      })
    ).id;
});

describe("plan definitions", () => {
  it("tiers are strictly ordered for every resource", () => {
    for (const resource of Object.keys(PLAN_LIMITS.FREE) as PlanResource[]) {
      expect(PLAN_LIMITS.FREE[resource]).toBeLessThan(PLAN_LIMITS.STARTER[resource]);
      expect(PLAN_LIMITS.STARTER[resource]).toBeLessThan(PLAN_LIMITS.PRO[resource]);
    }
  });

  it("new tenants default to STARTER", async () => {
    const tenant = await db.tenant.create({ data: { slug: `def-${uniqueSuffix()}`, name: "D" } });
    expect(tenant.plan).toBe("STARTER");
  });
});

describe("assertWithinPlan", () => {
  it("allows up to the limit and rejects the next create (apiKeys)", async () => {
    const tenant = await freeTenant();
    free.apiKeys = 2;

    await createApiKey({ tenantId: tenant.id, name: "k1", scopes: ["menu:read"] });
    await createApiKey({ tenantId: tenant.id, name: "k2", scopes: ["menu:read"] });

    const error = await createApiKey({
      tenantId: tenant.id,
      name: "k3",
      scopes: ["menu:read"],
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PlanLimitError);
    expect((error as PlanLimitError).resource).toBe("apiKeys");
    expect((error as PlanLimitError).status).toBe(402);
    expect(await db.apiKey.count({ where: { tenantId: tenant.id } })).toBe(2);
  });

  it("revoked API keys do not count against the limit", async () => {
    const tenant = await freeTenant();
    free.apiKeys = 1;
    const key = await createApiKey({ tenantId: tenant.id, name: "k1", scopes: ["menu:read"] });
    await db.apiKey.update({ where: { id: key.id }, data: { isActive: false } });
    await expect(assertWithinPlan(tenant.id, "apiKeys")).resolves.toBeUndefined();
  });

  it("enforces the dish limit and ignores soft-deleted dishes", async () => {
    const tenant = await freeTenant();
    const categoryId = await categoryOf(tenant.id);
    free.dishes = 1;

    const first = await createDish({ ...dishInput(categoryId), tenantId: tenant.id });
    await expect(createDish({ ...dishInput(categoryId), tenantId: tenant.id })).rejects.toBeInstanceOf(
      PlanLimitError
    );

    await db.dish.update({ where: { id: first.id }, data: { deletedAt: new Date() } });
    await expect(
      createDish({ ...dishInput(categoryId), tenantId: tenant.id })
    ).resolves.toBeTruthy();
  });

  it("enforces the gallery limit", async () => {
    const tenant = await freeTenant();
    free.galleryImages = 1;
    const input = {
      tenantId: tenant.id,
      title: "t",
      altText: "a",
      imageUrl: "/x.jpg",
      category: "FOOD" as const,
      sortOrder: 0,
      isPublished: true,
    };
    await createGalleryImage(input);
    await expect(createGalleryImage(input)).rejects.toBeInstanceOf(PlanLimitError);
  });

  it("enforces orders per month at the top of createOrder, writing nothing", async () => {
    const tenant = await freeTenant();
    free.ordersPerMonth = 1;
    const input = {
      tenantId: tenant.id,
      customerName: "Q",
      customerEmail: `q-${uniqueSuffix()}@example.com`,
      customerPhone: "+91 90000 00000",
      allowAdHoc: true,
      items: [{ dishName: "Chai", quantity: 1, price: 50 }],
    };

    await createOrder(input);
    await expect(createOrder(input)).rejects.toBeInstanceOf(PlanLimitError);
    expect(await db.order.count({ where: { tenantId: tenant.id } })).toBe(1);
  });

  it("orders from previous months do not count", async () => {
    const tenant = await freeTenant();
    free.ordersPerMonth = 1;
    const input = {
      tenantId: tenant.id,
      customerName: "Q",
      customerEmail: `q-${uniqueSuffix()}@example.com`,
      customerPhone: "+91 90000 00000",
      allowAdHoc: true,
      items: [{ dishName: "Chai", quantity: 1, price: 50 }],
    };
    const old = await createOrder(input);
    const lastMonth = new Date();
    lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 2);
    await db.order.update({ where: { id: old.id }, data: { createdAt: lastMonth } });

    await expect(assertWithinPlan(tenant.id, "ordersPerMonth")).resolves.toBeUndefined();
  });

  it("limits are per tenant", async () => {
    const a = await freeTenant();
    const b = await freeTenant();
    free.apiKeys = 1;
    await createApiKey({ tenantId: a.id, name: "k", scopes: ["menu:read"] });
    await expect(assertWithinPlan(b.id, "apiKeys")).resolves.toBeUndefined();
  });

  it("getPlanUsage reports used and limit per resource", async () => {
    const tenant = await freeTenant();
    await createApiKey({ tenantId: tenant.id, name: "k", scopes: ["menu:read"] });
    const usage = await getPlanUsage(tenant.id);
    expect(usage.plan).toBe("FREE");
    expect(usage.usage.find((u) => u.resource === "apiKeys")).toEqual({
      resource: "apiKeys",
      used: 1,
      limit: original.apiKeys,
    });
  });
});
