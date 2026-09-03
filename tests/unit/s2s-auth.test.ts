import { describe, it, expect, beforeEach } from "vitest";
import { createApiKey, verifyS2SRequest } from "@/lib/auth/s2s";
import { signWebhookPayload } from "@/lib/webhooks/dispatcher";
import { db } from "@/lib/db/prisma";
import { getOrCreateDefaultTenant } from "@/lib/db/tenant";

describe("S2S M2M Authentication & Webhooks", () => {
  let tenantId: string;

  beforeEach(async () => {
    const tenant = await getOrCreateDefaultTenant();
    tenantId = tenant.id;
  });

  it("generates a secure API key with sp_live_ prefix and valid SHA-256 hash", async () => {
    const keyResult = await createApiKey({
      tenantId,
      name: "Test POS Integration",
      scopes: ["orders:read", "orders:write"],
    });

    expect(keyResult.apiKey).toMatch(/^sp_live_[0-9a-f]{48}$/);
    expect(keyResult.keyPrefix).toBe(keyResult.apiKey.slice(0, 16));

    const inDb = await db.apiKey.findUnique({
      where: { id: keyResult.id },
    });
    expect(inDb).not.toBeNull();
    expect(inDb?.keyPrefix).toBe(keyResult.keyPrefix);
    expect(inDb?.keyHash).toHaveLength(64); // SHA-256 hex length
  });

  it("successfully authenticates a valid API key with matching scope", async () => {
    const keyResult = await createApiKey({
      tenantId,
      name: "Valid Scope Test",
      scopes: ["orders:write"],
    });

    const mockRequest = new Request("https://api.example.com/api/v1/orders", {
      headers: {
        authorization: `Bearer ${keyResult.apiKey}`,
      },
    });

    const verification = await verifyS2SRequest(mockRequest, "orders:write");
    expect(verification.success).toBe(true);
    if (verification.success) {
      expect(verification.context.name).toBe("Valid Scope Test");
      expect(verification.context.tenantId).toBe(tenantId);
    }
  });

  it("rejects an API key when a required scope is missing", async () => {
    const keyResult = await createApiKey({
      tenantId,
      name: "Read-Only Key",
      scopes: ["menu:read"],
    });

    const mockRequest = new Request("https://api.example.com/api/v1/orders", {
      headers: {
        authorization: `Bearer ${keyResult.apiKey}`,
      },
    });

    const verification = await verifyS2SRequest(mockRequest, "orders:write");
    expect(verification.success).toBe(false);
    if (!verification.success) {
      expect(verification.status).toBe(403);
      expect(verification.error).toContain("lacks required scope 'orders:write'");
    }
  });

  it("computes standard HMAC-SHA256 signatures for webhook delivery", () => {
    const payload = JSON.stringify({ event: "order.created", orderId: "123" });
    const secret = "whsec_test_secret_123456789";
    const timestamp = 1725412800;

    const signatureHeader = signWebhookPayload(payload, secret, timestamp);
    expect(signatureHeader).toMatch(/^t=1725412800,v1=[0-9a-f]{64}$/);

    // Verify determinism
    const signatureHeader2 = signWebhookPayload(payload, secret, timestamp);
    expect(signatureHeader).toBe(signatureHeader2);
  });
});
