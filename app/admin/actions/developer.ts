"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guards";
import { permissions } from "@/config/roles";
import { createApiKey, ApiScope } from "@/lib/auth/s2s";
import { getOrCreateDefaultTenant } from "@/lib/db/tenant";
import { db } from "@/lib/db/prisma";

export interface GenerateKeyResult {
  ok: boolean;
  apiKey?: string;
  keyPrefix?: string;
  error?: string;
}

export async function generateApiKeyAction(
  name: string,
  scopes: ApiScope[]
): Promise<GenerateKeyResult> {
  await requirePermission(permissions.MANAGE_SETTINGS);

  if (!name.trim()) {
    return { ok: false, error: "Key name is required" };
  }

  if (!scopes || scopes.length === 0) {
    return { ok: false, error: "At least one scope must be selected" };
  }

  try {
    const tenant = await getOrCreateDefaultTenant();
    const result = await createApiKey({
      tenantId: tenant.id,
      name: name.trim(),
      scopes,
    });

    revalidatePath("/admin/developers");
    return {
      ok: true,
      apiKey: result.apiKey,
      keyPrefix: result.keyPrefix,
    };
  } catch (error) {
    console.error("generateApiKeyAction error:", error);
    return { ok: false, error: "Failed to generate API Key" };
  }
}

export async function revokeApiKeyAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requirePermission(permissions.MANAGE_SETTINGS);

  try {
    await db.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath("/admin/developers");
    return { ok: true };
  } catch (error) {
    console.error("revokeApiKeyAction error:", error);
    return { ok: false, error: "Failed to revoke API Key" };
  }
}

export async function createWebhookSubscriptionAction(
  url: string,
  events: string[]
): Promise<{ ok: boolean; secret?: string; error?: string }> {
  await requirePermission(permissions.MANAGE_SETTINGS);

  try {
    new URL(url); // Validate URL format
  } catch {
    return { ok: false, error: "Invalid Webhook destination URL" };
  }

  try {
    const tenant = await getOrCreateDefaultTenant();
    const secret = `whsec_${crypto.randomBytes(24).toString("hex")}`;

    await db.webhookSubscription.create({
      data: {
        tenantId: tenant.id,
        url: url.trim(),
        secret,
        events: events.length > 0 ? events : ["*"],
      },
    });

    revalidatePath("/admin/developers");
    return { ok: true, secret };
  } catch (error) {
    console.error("createWebhookSubscriptionAction error:", error);
    return { ok: false, error: "Failed to create webhook endpoint" };
  }
}

export async function deleteWebhookSubscriptionAction(id: string): Promise<{ ok: boolean; error?: string }> {
  await requirePermission(permissions.MANAGE_SETTINGS);

  try {
    await db.webhookSubscription.delete({
      where: { id },
    });

    revalidatePath("/admin/developers");
    return { ok: true };
  } catch (error) {
    console.error("deleteWebhookSubscriptionAction error:", error);
    return { ok: false, error: "Failed to delete webhook endpoint" };
  }
}
