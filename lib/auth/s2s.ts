import "server-only";
import crypto from "node:crypto";
import { db } from "@/lib/db/prisma";
import { AVAILABLE_SCOPES, type ApiScope } from "@/config/s2s";
import { assertWithinPlan } from "@/lib/plans";

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
  await assertWithinPlan(params.tenantId, "apiKeys");

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

/** Minimum gap between `lastUsedAt` writes for one key. */
export const LAST_USED_WRITE_INTERVAL_MS = 60_000;

const lastWriteAt = new Map<string, number>();

/** Compare two hex SHA-256 digests in constant time. */
export function digestsMatch(storedHex: string, computedHex: string): boolean {
  const a = Buffer.from(storedHex, "hex");
  const b = Buffer.from(computedHex, "hex");
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * True when `lastUsedAt` is older than the throttle interval. An in-process map
 * also suppresses bursts before the stored value is visible to this instance.
 */
export function shouldRecordUse(keyId: string, storedLastUsedAt: Date | null | undefined, now = Date.now()): boolean {
  const local = lastWriteAt.get(keyId) ?? 0;
  const stored = storedLastUsedAt ? storedLastUsedAt.getTime() : 0;
  if (now - Math.max(local, stored) < LAST_USED_WRITE_INTERVAL_MS) return false;
  if (lastWriteAt.size > 5_000) lastWriteAt.clear();
  lastWriteAt.set(keyId, now);
  return true;
}

/**
 * Extracts and verifies an API key from the Authorization header or x-api-key header.
 *
 * Lookup is by SHA-256 hash of the presented key (the secret itself is never
 * compared or stored). `digestsMatch` then confirms the digests with
 * `crypto.timingSafeEqual`. `lastUsedAt` is written at most once per
 * `LAST_USED_WRITE_INTERVAL_MS` per key, keeping the hot path read-only.
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

  // The row was found by an indexed hash lookup, which is not itself a secret
  // comparison. This is a defence-in-depth check on the raw 32-byte digests
  // (equal length by construction), so it never short-circuits on a prefix.
  if (!digestsMatch(apiKey.keyHash, tokenHash)) {
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

  // An empty list means "any address". Otherwise the caller's first forwarded hop must be listed.
  if (apiKey.ipAllowlist?.length) {
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
    if (!clientIp || !apiKey.ipAllowlist.includes(clientIp)) {
      return { success: false, status: 403, error: "Forbidden: request IP is not allowed for this API Key" };
    }
  }

  if (shouldRecordUse(apiKey.id, apiKey.lastUsedAt)) {
    db.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});
  }

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
