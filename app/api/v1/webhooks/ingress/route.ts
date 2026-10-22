import { apiError } from "@/lib/api/errors";
import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db/prisma";
import { getOrCreateDefaultTenant } from "@/lib/db/tenant";
import { broadcastEvent } from "@/lib/realtime/bus";

// HMAC verification needs the Node crypto module, not the edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const webhookPayloadSchema = z.object({
  event: z.enum(["order.updated"]),
  orderId: z.string().uuid(),
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "COMPLETED",
    "CANCELLED",
  ]),
});

/** A short, constant-time-ish way to reject malformed hex before comparing. */
const HEX_SHA256 = /^[0-9a-f]{64}$/i;

function readSignature(request: Request): string | null {
  const raw =
    request.headers.get("x-spice-signature") ??
    request.headers.get("x-webhook-signature");
  if (!raw) return null;

  const trimmed = raw.trim();
  return trimmed.toLowerCase().startsWith("sha256=")
    ? trimmed.slice("sha256=".length).trim()
    : trimmed;
}

/**
 * POST /api/v1/webhooks/ingress
 * Secure partner webhook receiver (POS status updates, delivery updates).
 *
 * The signature is verified over the raw request body before any parsing, so a
 * body that changes after signing can never be accepted. The order update is
 * scoped to the tenant authenticated by that shared partner secret; a body
 * `tenantId` is not authorisation.
 */
export async function POST(request: Request) {
  const secret = process.env.PARTNER_WEBHOOK_SECRET;
  const providedSignature = readSignature(request);

  if (!secret || !providedSignature || !HEX_SHA256.test(providedSignature)) {
    return apiError(401, "Unauthorized: missing or invalid webhook signature");
  }

  // Read the exact bytes that were signed. `request.json()` would re-serialise
  // and silently break the HMAC comparison.
  const rawBody = await request.text();

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(providedSignature, "hex");

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return apiError(401, "Unauthorized: invalid webhook signature");
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return apiError(400, "Invalid JSON body");
  }

  const parsed = webhookPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(400, "Invalid payload", undefined, { details: parsed.error.issues });
  }

  const { orderId, status } = parsed.data;

  // The shared partner secret authenticates the flagship integration. The
  // tenant comes from the server-side tenant record, never from the payload.
  const tenant = await getOrCreateDefaultTenant();

  const result = await db.order.updateMany({
    where: { id: orderId, tenantId: tenant.id },
    data: { orderStatus: status },
  });

  if (result.count === 0) {
    return apiError(404, "Order not found");
  }

  const updated = await db.order.findUnique({ where: { id: orderId } });

  if (updated) {
    broadcastEvent({
      type: "order:status_changed",
      tenantId: updated.tenantId ?? tenant.id,
      timestamp: new Date().toISOString(),
      data: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        orderStatus: updated.orderStatus,
      },
    });
  }

  return NextResponse.json({
    received: true,
    timestamp: new Date().toISOString(),
  });
}
