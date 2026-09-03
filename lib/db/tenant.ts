import { db } from "@/lib/db/prisma";

export const DEFAULT_TENANT_SLUG = "spice-saffron";

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  subscriptionPlan: "STARTER" | "PRO" | "ENTERPRISE";
  isActive: boolean;
}

/**
 * Ensures the primary flagship tenant exists in the database and links
 * any previously unassigned records.
 */
export async function getOrCreateDefaultTenant(): Promise<TenantContext> {
  const existing = await db.tenant.findUnique({
    where: { slug: DEFAULT_TENANT_SLUG },
  });

  if (existing) {
    return existing;
  }

  const tenant = await db.tenant.create({
    data: {
      slug: DEFAULT_TENANT_SLUG,
      name: "Spice & Saffron Flagship (Hauz Khas)",
      subscriptionPlan: "ENTERPRISE",
      isActive: true,
    },
  });

  // Link unassigned dishes, categories, orders, reservations
  try {
    await Promise.all([
      db.category.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } }),
      db.dish.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } }),
      db.order.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } }),
      db.reservation.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } }),
      db.admin.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } }),
    ]);
  } catch (error) {
    console.error("[tenant] Error backfilling default tenant IDs:", error);
  }

  return tenant;
}

/**
 * Resolves a tenant by slug or returns the default flagship tenant.
 */
export async function resolveTenant(slug?: string | null): Promise<TenantContext> {
  if (!slug || slug === DEFAULT_TENANT_SLUG) {
    return getOrCreateDefaultTenant();
  }

  const tenant = await db.tenant.findUnique({
    where: { slug },
  });

  if (!tenant || !tenant.isActive) {
    return getOrCreateDefaultTenant();
  }

  return tenant;
}
