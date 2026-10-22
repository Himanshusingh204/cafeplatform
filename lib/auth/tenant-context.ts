import "server-only";

import { resolveTenant } from "@/lib/db/tenant";

/**
 * The tenant an admin acts on. An admin bound to a tenant uses it; an unbound
 * (legacy single-tenant) admin falls back to the default tenant, which
 * `resolveTenant` only allows where the default tenant is enabled. It fails
 * closed otherwise.
 */
export async function getAdminTenantId(admin: { tenantId?: string | null }): Promise<string> {
  if (admin.tenantId) return admin.tenantId;
  return (await resolveTenant()).id;
}
