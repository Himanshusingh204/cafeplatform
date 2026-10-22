import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { resolveTaxRatePercent, pricing } from "@/config/pricing";
import { db } from "@/lib/db/prisma";
import {
  TenantResolutionError,
  getOrCreateDefaultTenant,
  resolveTenant,
} from "@/lib/db/tenant";
import { createDish } from "@/lib/services/menu";
import { createOrder } from "@/lib/services/orders";
import { dishInput, makeCategory, truncateTables, uniqueSuffix } from "../helpers/db";

const TABLES = ["LoyaltyLedger", "OrderItem", "Order", "CustomerUser"] as const;

beforeAll(async () => {
  await truncateTables(...TABLES);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await truncateTables(...TABLES);
});

describe("resolveTenant fails closed (P0-3)", () => {
  it("throws in production without an explicit tenant", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEFAULT_TENANT", "");
    await expect(resolveTenant()).rejects.toBeInstanceOf(TenantResolutionError);
  });

  it("allows the default tenant in production only with the opt-in flag", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEFAULT_TENANT", "true");
    const tenant = await resolveTenant();
    expect(tenant.slug).toBe("spice-saffron");
  });

  it("uses the default tenant outside production", async () => {
    const tenant = await resolveTenant();
    expect(tenant.slug).toBe("spice-saffron");
  });

  it("throws for an unknown slug instead of falling back", async () => {
    await expect(resolveTenant(`nope-${uniqueSuffix()}`)).rejects.toBeInstanceOf(
      TenantResolutionError
    );
  });
});

describe("per-tenant tax rate (P1-7 / D1)", () => {
  it("uses the tenant rate when set, else the default", () => {
    expect(resolveTaxRatePercent({ taxRatePercent: 12 })).toBe(12);
    expect(resolveTaxRatePercent({ taxRatePercent: "18.00" as unknown as number })).toBe(18);
    expect(resolveTaxRatePercent({ taxRatePercent: null })).toBe(pricing.defaultTaxRatePercent);
    expect(resolveTaxRatePercent()).toBe(pricing.defaultTaxRatePercent);
  });

  it("createOrder applies the order tenant's rate and persists tenantId", async () => {
    const suffix = uniqueSuffix();
    const tenant = await db.tenant.create({
      data: { slug: `t-${suffix}`, name: "Rate Tenant", taxRatePercent: "12.00" },
    });
    const category = await makeCategory();
    const dish = await createDish(dishInput(category.id, { name: `Rate ${suffix}`, price: 100 }));
    const tenantCategory = await db.category.create({
      data: { tenantId: tenant.id, name: `Cat ${suffix}`, slug: `cat-${suffix}`, isActive: true, sortOrder: 0 },
    });
    const tenantDish = await createDish({
      ...dishInput(tenantCategory.id, { name: `Own ${suffix}`, price: 100 }),
      tenantId: tenant.id,
    });

    const order = await createOrder({
      tenantId: tenant.id,
      customerName: "Rate Tester",
      customerEmail: `rate-${suffix}@example.com`,
      customerPhone: "+91 90000 00000",
      items: [{ dishId: tenantDish.id, dishName: tenantDish.name, quantity: 1, price: 100 }],
    });

    // Another tenant's dish id must not be orderable (cross-tenant pricing leak).
    await expect(
      createOrder({
        tenantId: tenant.id,
        customerName: "Foreign",
        customerEmail: `foreign-${suffix}@example.com`,
        customerPhone: "+91 90000 00000",
        items: [{ dishId: dish.id, dishName: dish.name, quantity: 1, price: 100 }],
      })
    ).rejects.toThrow();

    expect(order.tenantId).toBe(tenant.id);
    expect(Number(order.tax)).toBe(12);

    const def = await getOrCreateDefaultTenant();
    const order2 = await createOrder({
      customerName: "Default Tester",
      customerEmail: `def-${suffix}@example.com`,
      customerPhone: "+91 90000 00000",
      items: [{ dishId: dish.id, dishName: dish.name, quantity: 1, price: 100 }],
    });
    expect(order2.tenantId).toBe(def.id);
    expect(Number(order2.tax)).toBe(pricing.defaultTaxRatePercent);
  });
});
