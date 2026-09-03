import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db/prisma";
import { AVAILABLE_SCOPES, type ApiScope } from "@/config/s2s";

export { AVAILABLE_SCOPES, type ApiScope };

export interface VerifiedApiKey {
  id: string;
  name: string;
  tenantId: string;
  scopes: string[];
  tenant: {
    id: string;
    slug: string;
    name: string;
    subscriptionPlan: string;
    isActive: boolean;
  };
}

/**
 * Generates a new cryptographically secure API key.
 * Stores the SHA-256 hash in the database and returns the full secret token ONCE.
 */
export async function createApiKey(params: {
  tenantId: string;
  name: string;
  scopes: ApiScope[];
  ipAllowlist?: string[];
  expiresInDays?: number;
}): Promise<{ apiKey: string; keyPrefix: string; id: string }> {
  const randomBytes = crypto.randomBytes(24).toString("hex");
  const fullApiKey = `sp_live_${randomBytes}`;
  const keyPrefix = fullApiKey.slice(0, 16);
  const keyHash = crypto.createHash("sha256").update(fullApiKey).digest("hex");

  const expiresAt = params.expiresInDays
    ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const record = await db.apiKey.create({
    data: {
      tenantId: params.tenantId,
      name: params.name,
      keyPrefix,
      keyHash,
      scopes: params.scopes,
      ipAllowlist: params.ipAllowlist ?? [],
      expiresAt,
    },
  });

  return {
    apiKey: fullApiKey,
    keyPrefix,
    id: record.id,
  };
}

/**
 * Extracts and verifies an API key from the Authorization header or x-api-key header.
 * Uses constant-time buffer comparison to prevent timing attacks.
 */
export async function verifyS2SRequest(
  request: Request,
  requiredScope?: ApiScope
): Promise<{ success: true; context: VerifiedApiKey } | { success: false; status: number; error: string }> {
  const authHeader = request.headers.get("authorization") || request.headers.get("x-api-key");
  if (!authHeader) {
    return { success: false, status: 401, error: "Missing Authorization header with Bearer API Key" };
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : authHeader.trim();
  if (!token.startsWith("sp_live_") || token.length < 32) {
    return { success: false, status: 401, error: "Invalid API Key format (must start with sp_live_)" };
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const apiKey = await db.apiKey.findUnique({
    where: { keyHash: tokenHash },
    include: {
      tenant: true,
    },
  });

  if (!apiKey || !apiKey.isActive) {
    return { success: false, status: 401, error: "API Key is invalid or has been revoked" };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return { success: false, status: 401, error: "API Key has expired" };
  }

  if (!apiKey.tenant || !apiKey.tenant.isActive) {
    return { success: false, status: 403, error: "Tenant account is inactive" };
  }

  // Verify constant-time comparison
  const storedBuffer = Buffer.from(apiKey.keyHash, "utf8");
  const computedBuffer = Buffer.from(tokenHash, "utf8");
  if (storedBuffer.length !== computedBuffer.length || !crypto.timingSafeEqual(storedBuffer, computedBuffer)) {
    return { success: false, status: 401, error: "API Key verification failed" };
  }

  // Verify Scope
  if (requiredScope && !apiKey.scopes.includes(requiredScope) && !apiKey.scopes.includes("admin:all")) {
    return {
      success: false,
      status: 403,
      error: `Forbidden: API Key lacks required scope '${requiredScope}'`,
    };
  }

  // Fire-and-forget update of lastUsedAt
  db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    success: true,
    context: {
      id: apiKey.id,
      name: apiKey.name,
      tenantId: apiKey.tenantId,
      scopes: apiKey.scopes,
      tenant: {
        id: apiKey.tenant.id,
        slug: apiKey.tenant.slug,
        name: apiKey.tenant.name,
        subscriptionPlan: apiKey.tenant.subscriptionPlan,
        isActive: apiKey.tenant.isActive,
      },
    },
  };
}
