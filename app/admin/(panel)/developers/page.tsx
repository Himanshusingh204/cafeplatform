import { requirePermission } from "@/lib/auth/guards";
import { hasPermission, permissions } from "@/config/roles";
import { db } from "@/lib/db/prisma";
import { getAdminTenantId } from "@/lib/auth/tenant-context";
import { DeveloperPortal, ApiKeyItem, WebhookItem } from "@/components/admin/developer-portal";

export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const admin = await requirePermission(permissions.MANAGE_SETTINGS);

  const tenantId = await getAdminTenantId(admin);

  const [rawKeys, rawWebhooks] = await Promise.all([
    db.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    }),
    db.webhookSubscription.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const apiKeys: ApiKeyItem[] = rawKeys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    scopes: k.scopes,
    lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
    createdAt: k.createdAt.toISOString(),
    isActive: k.isActive,
  }));

  const webhooks: WebhookItem[] = rawWebhooks.map((w) => ({
    id: w.id,
    url: w.url,
    events: w.events,
    createdAt: w.createdAt.toISOString(),
    isActive: w.isActive,
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <DeveloperPortal
        apiKeys={apiKeys}
        webhooks={webhooks}
        canManage={hasPermission(admin.role, permissions.MANAGE_SETTINGS)}
      />
    </div>
  );
}
