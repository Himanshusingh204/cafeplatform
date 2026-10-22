import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db/prisma";
import {
  DEFAULT_TENANT_SLUG,
  TENANT_CACHE_TTL_MS,
  TenantResolutionError,
  clearTenantCache,
  getTenantById,
  resolveTenant,
  setTenantCacheTtl,
  updateTenant,
} from "@/lib/db/tenant";
import { uniqueSuffix } from "../helpers/db";

beforeEach(() => {
  setTenantCacheTtl(TENANT_CACHE_TTL_MS);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  clearTenantCache();
});

async function makeTenant() {
  return db.tenant.create({
    data: { slug: `cache-${uniqueSuffix()}`, name: "Cache Tenant" },
  });
}

describe("tenant lookup cache (P2-6)", () => {
  it("serves repeated slug and id lookups from memory", async () => {
    const tenant = await makeTenant();
    const spy = vi.spyOn(db.tenant, "findUnique");

    await resolveTenant(tenant.slug);
    await resolveTenant(tenant.slug);
    await getTenantById(tenant.id); // populated by the slug lookup

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("expires entries after the TTL", async () => {
    const tenant = await makeTenant();
    const spy = vi.spyOn(db.tenant, "findUnique");
    const now = Date.now();
    const clock = vi.spyOn(Date, "now");

    clock.mockReturnValue(now);
    await resolveTenant(tenant.slug);
    clock.mockReturnValue(now + TENANT_CACHE_TTL_MS - 1);
    await resolveTenant(tenant.slug);
    expect(spy).toHaveBeenCalledTimes(1);

    clock.mockReturnValue(now + TENANT_CACHE_TTL_MS + 1);
    await resolveTenant(tenant.slug);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("updateTenant invalidates both the id and slug entries", async () => {
    const tenant = await makeTenant();
    await resolveTenant(tenant.slug);

    await updateTenant(tenant.id, { isActive: false });

    await expect(resolveTenant(tenant.slug)).rejects.toBeInstanceOf(TenantResolutionError);
    await expect(getTenantById(tenant.id)).rejects.toBeInstanceOf(TenantResolutionError);
  });

  it("updateTenant drops the old slug when it is renamed", async () => {
    const tenant = await makeTenant();
    await resolveTenant(tenant.slug);
    const renamed = `renamed-${uniqueSuffix()}`;

    await updateTenant(tenant.id, { slug: renamed });

    await expect(resolveTenant(tenant.slug)).rejects.toBeInstanceOf(TenantResolutionError);
    expect((await resolveTenant(renamed)).id).toBe(tenant.id);
  });

  it("does not cache misses", async () => {
    const slug = `late-${uniqueSuffix()}`;
    await expect(resolveTenant(slug)).rejects.toBeInstanceOf(TenantResolutionError);
    await db.tenant.create({ data: { slug, name: "Late" } });
    expect((await resolveTenant(slug)).slug).toBe(slug);
  });

  it("a TTL of 0 disables caching", async () => {
    setTenantCacheTtl(0);
    const tenant = await makeTenant();
    const spy = vi.spyOn(db.tenant, "findUnique");
    await resolveTenant(tenant.slug);
    await resolveTenant(tenant.slug);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("tenant read path never writes", () => {
  it("an unknown slug throws without creating anything", async () => {
    const create = vi.spyOn(db.tenant, "create");
    await expect(resolveTenant(`ghost-${uniqueSuffix()}`)).rejects.toBeInstanceOf(
      TenantResolutionError
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("in production the default slug is looked up, never bootstrapped", async () => {
    await resolveTenant(DEFAULT_TENANT_SLUG); // make sure it exists (dev path)
    clearTenantCache();

    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEFAULT_TENANT", "");
    const create = vi.spyOn(db.tenant, "create");
    const tenant = await resolveTenant(DEFAULT_TENANT_SLUG);

    expect(tenant.slug).toBe(DEFAULT_TENANT_SLUG);
    expect(create).not.toHaveBeenCalled();
  });

  it("getTenantById never writes", async () => {
    const create = vi.spyOn(db.tenant, "create");
    await expect(
      getTenantById("00000000-0000-0000-0000-000000000000")
    ).rejects.toBeInstanceOf(TenantResolutionError);
    expect(create).not.toHaveBeenCalled();
  });
});
