import { db } from "@/lib/db/prisma";
import { getTenantById } from "@/lib/db/tenant";
import type { PlanTier } from "@/lib/generated/prisma/enums";

/**
 * Plan tiers and quotas (ROADMAP Phase 9 slice).
 *
 * Limits are code, not data: tuning one needs a deploy, not a migration. A
 * tenant's tier is `Tenant.plan`. `Infinity` means unlimited.
 */
export type PlanResource = "dishes" | "galleryImages" | "adminUsers" | "ordersPerMonth" | "apiKeys";

export type PlanLimits = Record<PlanResource, number>;

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  FREE: { dishes: 25, galleryImages: 10, adminUsers: 2, ordersPerMonth: 100, apiKeys: 1 },
  STARTER: { dishes: 200, galleryImages: 50, adminUsers: 5, ordersPerMonth: 2_000, apiKeys: 3 },
  PRO: {
    dishes: 2_000,
    galleryImages: 500,
    adminUsers: 25,
    ordersPerMonth: 50_000,
    apiKeys: 25,
  },
} as const;

export const PLAN_RESOURCES = Object.keys(PLAN_LIMITS.FREE) as PlanResource[];

/** Thrown when creating one more `resource` would exceed the tenant's plan. */
export class PlanLimitError extends Error {
  readonly code = "PLAN_LIMIT_EXCEEDED";
  /** HTTP status adapters should map this to (402 Payment Required). */
  readonly status = 402;
  constructor(
    readonly resource: PlanResource,
    readonly limit: number,
    readonly plan: PlanTier
  ) {
    super(`The ${plan} plan allows up to ${limit} ${resource}. Upgrade the plan to add more.`);
    this.name = "PlanLimitError";
  }
}

export function startOfCurrentMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function countUsage(tenantId: string, resource: PlanResource): Promise<number> {
  switch (resource) {
    case "dishes":
      return db.dish.count({ where: { tenantId, deletedAt: null } });
    case "galleryImages":
      return db.galleryImage.count({ where: { tenantId } });
    case "adminUsers":
      return db.admin.count({ where: { tenantId, isActive: true } });
    case "ordersPerMonth":
      return db.order.count({
        where: { tenantId, createdAt: { gte: startOfCurrentMonthUtc() } },
      });
    case "apiKeys":
      return db.apiKey.count({ where: { tenantId, isActive: true } });
  }
}

/**
 * Throws `PlanLimitError` if the tenant already holds its plan's maximum of
 * `resource`. Call it immediately before the create. It is a soft quota check
 * (count then insert), so a burst of concurrent creates can overshoot by the
 * concurrency level; this is acceptable for quotas, not for security limits.
 */
export async function assertWithinPlan(tenantId: string, resource: PlanResource): Promise<void> {
  const tenant = await getTenantById(tenantId);
  const plan = (tenant.plan ?? "STARTER") as PlanTier;
  const limit = PLAN_LIMITS[plan][resource];
  if (!Number.isFinite(limit)) return;

  const used = await countUsage(tenantId, resource);
  if (used >= limit) {
    throw new PlanLimitError(resource, limit, plan);
  }
}

export interface PlanUsage {
  plan: PlanTier;
  usage: { resource: PlanResource; used: number; limit: number }[];
}

/** Read-only usage snapshot for the admin settings page. */
export async function getPlanUsage(tenantId: string): Promise<PlanUsage> {
  const tenant = await getTenantById(tenantId);
  const plan = (tenant.plan ?? "STARTER") as PlanTier;
  const usage = await Promise.all(
    PLAN_RESOURCES.map(async (resource) => ({
      resource,
      used: await countUsage(tenantId, resource),
      limit: PLAN_LIMITS[plan][resource],
    }))
  );
  return { plan, usage };
}
