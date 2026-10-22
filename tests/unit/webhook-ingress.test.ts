import { createHmac } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/v1/webhooks/ingress/route";
import { db } from "@/lib/db/prisma";
import { getOrCreateDefaultTenant } from "@/lib/db/tenant";
import { truncateTables, uniqueSuffix } from "../helpers/db";

const SECRET = "test-partner-webhook-secret";
const originalSecret = process.env.PARTNER_WEBHOOK_SECRET;

function sign(rawBody: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function webhookRequest(rawBody: string, signature?: string | null): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature !== null) headers["x-spice-signature"] = signature ?? "";
  return new Request("http://localhost/api/v1/webhooks/ingress", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

async function makeOrder(tenantId: string) {
  return db.order.create({
    data: {
      tenantId,
      orderNumber: `WH-${uniqueSuffix()}`,
      customerName: "Webhook Tester",
      customerEmail: `webhook-${uniqueSuffix()}@example.com`,
      customerPhone: "+91 90000 00011",
      pickupTime: "ASAP",
      subtotal: "100.00",
      tax: "5.00",
      total: "105.00",
      paymentStatus: "PAID",
      orderStatus: "PENDING",
    },
  });
}

beforeAll(async () => {
  process.env.PARTNER_WEBHOOK_SECRET = SECRET;
  await truncateTables("OrderItem", "Order");
});

afterAll(async () => {
  await truncateTables("OrderItem", "Order");
  if (originalSecret === undefined) delete process.env.PARTNER_WEBHOOK_SECRET;
  else process.env.PARTNER_WEBHOOK_SECRET = originalSecret;
});

describe("partner webhook ingress — HMAC verification (P0)", () => {
  it("rejects a missing signature without mutating the order", async () => {
    const tenant = await getOrCreateDefaultTenant();
    const order = await makeOrder(tenant.id);
    const rawBody = JSON.stringify({
      event: "order.updated",
      orderId: order.id,
      status: "CONFIRMED",
    });

    const response = await POST(webhookRequest(rawBody, null));

    expect(response.status).toBe(401);
    const after = await db.order.findUnique({ where: { id: order.id } });
    expect(after?.orderStatus).toBe("PENDING");
  });

  it("rejects a forged signature without mutating the order", async () => {
    const tenant = await getOrCreateDefaultTenant();
    const order = await makeOrder(tenant.id);
    const rawBody = JSON.stringify({
      event: "order.updated",
      orderId: order.id,
      status: "CONFIRMED",
    });

    const response = await POST(webhookRequest(rawBody, sign(rawBody, "wrong-secret")));

    expect(response.status).toBe(401);
    const after = await db.order.findUnique({ where: { id: order.id } });
    expect(after?.orderStatus).toBe("PENDING");
  });

  it("fails closed when the shared secret is unset", async () => {
    const tenant = await getOrCreateDefaultTenant();
    const order = await makeOrder(tenant.id);
    const rawBody = JSON.stringify({
      event: "order.updated",
      orderId: order.id,
      status: "CONFIRMED",
    });

    delete process.env.PARTNER_WEBHOOK_SECRET;
    try {
      const response = await POST(webhookRequest(rawBody, sign(rawBody)));
      expect(response.status).toBe(401);
    } finally {
      process.env.PARTNER_WEBHOOK_SECRET = SECRET;
    }

    const after = await db.order.findUnique({ where: { id: order.id } });
    expect(after?.orderStatus).toBe("PENDING");
  });

  it("accepts a valid HMAC over the raw body, with the sha256= prefix", async () => {
    const tenant = await getOrCreateDefaultTenant();
    const order = await makeOrder(tenant.id);
    const rawBody = JSON.stringify({
      event: "order.updated",
      orderId: order.id,
      status: "PREPARING",
      // A body-supplied tenant is never authoritative; it must be ignored.
      tenantId: "11111111-1111-4111-8111-111111111111",
    });

    const response = await POST(webhookRequest(rawBody, `sha256=${sign(rawBody)}`));

    expect(response.status).toBe(200);
    const after = await db.order.findUnique({ where: { id: order.id } });
    expect(after?.orderStatus).toBe("PREPARING");
  });

  it("does not update an order belonging to another tenant", async () => {
    const otherTenant = await db.tenant.create({
      data: { slug: `other-${uniqueSuffix()}`, name: "Other Tenant", isActive: true },
    });
    const order = await makeOrder(otherTenant.id);
    const rawBody = JSON.stringify({
      event: "order.updated",
      orderId: order.id,
      status: "CANCELLED",
      tenantId: otherTenant.id,
    });

    const response = await POST(webhookRequest(rawBody, sign(rawBody)));

    expect(response.status).toBe(404);
    const after = await db.order.findUnique({ where: { id: order.id } });
    expect(after?.orderStatus).toBe("PENDING");
  });

  it("rejects a payload that fails validation even with a valid signature", async () => {
    const rawBody = JSON.stringify({
      event: "order.updated",
      orderId: "not-a-uuid",
      status: "SHIPPED",
    });

    const response = await POST(webhookRequest(rawBody, sign(rawBody)));

    expect(response.status).toBe(400);
  });
});
