import { db } from "@/lib/db/prisma";
import type { PlanTier } from "@/lib/generated/prisma/enums";

export const DEFAULT_TENANT_SLUG = "spice-saffron";

export interface TenantContext {
  id: string;
  slug: string;
  name: string;
  subscriptionPlan: "STARTER" | "PRO" | "ENTERPRISE";
  plan?: PlanTier;
  isActive: boolean;
  taxRatePercent?: { toString(): string } | number | null;
  currency?: string;
}

// ---------------------------------------------------------------------------
// In-process TTL cache (AUDIT P2-6)
//
// Tenant rows change rarely but are read on every public request. The cache is
// per process and holds the row for TTL_MS; `invalidateTenant` / `updateTenant`
// drop it explicitly. Other processes converge within one TTL, which is the
// documented staleness bound for a deactivation or plan change.
// ---------------------------------------------------------------------------

export const TENANT_CACHE_TTL_MS = 60_000;

type CachedTenant = Awaited<ReturnType<typeof db.tenant.findUnique>> & object;

interface CacheEntry {
  tenant: CachedTenant;
  expiresAt: number;
}

const byId = new Map<string, CacheEntry>();
const bySlug = new Map<string, CacheEntry>();
let ttlMs = TENANT_CACHE_TTL_MS;

/** Test hook: override the TTL (0 disables caching). */
export function setTenantCacheTtl(ms: number): void {
  ttlMs = ms;
  clearTenantCache();
}

export function clearTenantCache(): void {
  byId.clear();
  bySlug.clear();
}

/** Drops every cached entry for one tenant (by id and/or slug). */
export function invalidateTenant(ref: { id?: string; slug?: string }): void {
  if (ref.id) {
    const hit = byId.get(ref.id);
    if (hit) bySlug.delete(hit.tenant.slug);
    byId.delete(ref.id);
  }
  if (ref.slug) {
    const hit = bySlug.get(ref.slug);
    if (hit) byId.delete(hit.tenant.id);
    bySlug.delete(ref.slug);
  }
}

function remember(tenant: CachedTenant): CachedTenant {
  if (ttlMs > 0) {
    const entry = { tenant, expiresAt: Date.now() + ttlMs };
    byId.set(tenant.id, entry);
    bySlug.set(tenant.slug, entry);
  }
  return tenant;
}

function fresh(entry: CacheEntry | undefined): CachedTenant | null {
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) return null;
  return entry.tenant;
}

async function findById(id: string): Promise<CachedTenant | null> {
  const hit = fresh(byId.get(id));
  if (hit) return hit;
  const tenant = await db.tenant.findUnique({ where: { id } });
  return tenant ? remember(tenant) : null;
}

async function findBySlug(slug: string): Promise<CachedTenant | null> {
  const hit = fresh(bySlug.get(slug));
  if (hit) return hit;
  const tenant = await db.tenant.findUnique({ where: { slug } });
  return tenant ? remember(tenant) : null;
}

/**
 * Updates a tenant and invalidates its cache entries (old and new slug).
 * All tenant writes must go through here so the cache cannot serve a stale row
 * from this process.
 */
export async function updateTenant(
  id: string,
  data: Parameters<typeof db.tenant.update>[0]["data"]
) {
  const before = byId.get(id)?.tenant.slug;
  const updated = await db.tenant.update({ where: { id }, data });
  invalidateTenant({ id, slug: before });
  invalidateTenant({ id: updated.id, slug: updated.slug });
  return updated;
}

/**
 * Dev / single-tenant path ONLY: ensures the flagship tenant exists and links
 * any previously unassigned records. This is the only place the tenant read
 * path may write, and `resolveTenant` reaches it only when
 * `isDefaultTenantAllowed()` is true.
 */
export async function getOrCreateDefaultTenant(): Promise<TenantContext> {
  const existing = await findBySlug(DEFAULT_TENANT_SLUG);

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
  remember(tenant);

  // Link unassigned legacy rows (only the tables whose tenantId is still nullable).
  try {
    await Promise.all([
      db.reservation.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } }),
      db.admin.updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } }),
    ]);
  } catch (error) {
    console.error("[tenant] Error backfilling default tenant IDs:", error);
  }

  return tenant;
}

/**
 * Thrown when a tenant cannot be resolved safely. Fail closed: callers must not
 * fall back to another tenant's data (AUDIT P0-3).
 */
export class TenantResolutionError extends Error {
  readonly code = "TENANT_RESOLUTION_FAILED";
  constructor(message: string) {
    super(message);
    this.name = "TenantResolutionError";
  }
}

/**
 * The implicit default tenant is allowed outside production, or anywhere when
 * a single-tenant install opts in with `ALLOW_DEFAULT_TENANT=true`.
 */
export function isDefaultTenantAllowed(): boolean {
  if (process.env.ALLOW_DEFAULT_TENANT === "true") return true;
  return process.env.NODE_ENV !== "production";
}

/** Loads an active tenant by id; throws if it does not exist. Never writes. */
export async function getTenantById(id: string): Promise<TenantContext> {
  const tenant = await findById(id);
  if (!tenant || !tenant.isActive) {
    throw new TenantResolutionError(`Tenant "${id}" was not found or is inactive.`);
  }
  return tenant;
}

/**
 * Resolves a tenant by slug. Without a slug, the default tenant is used only
 * when explicitly allowed (see `isDefaultTenantAllowed`); an unknown or
 * inactive slug always throws. The only write is the explicit default-tenant
 * bootstrap in `getOrCreateDefaultTenant`.
 */
export async function resolveTenant(slug?: string | null): Promise<TenantContext> {
  if (!slug) {
    if (!isDefaultTenantAllowed()) {
      throw new TenantResolutionError(
        "No tenant specified and the default tenant is disabled (set ALLOW_DEFAULT_TENANT=true for single-tenant installs)."
      );
    }
    return getOrCreateDefaultTenant();
  }

  // Explicit default slug: bootstrap it only where the default tenant is allowed.
  if (slug === DEFAULT_TENANT_SLUG && isDefaultTenantAllowed()) {
    return getOrCreateDefaultTenant();
  }

  const tenant = await findBySlug(slug);
  if (!tenant || !tenant.isActive) {
    throw new TenantResolutionError(`Tenant "${slug}" was not found or is inactive.`);
  }
  return tenant;
}
